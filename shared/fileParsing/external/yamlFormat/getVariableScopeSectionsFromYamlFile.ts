import {
    Document,
    isMap,
    isScalar,
    isSeq,
    LineCounter,
    Node,
    parseDocument,
    Scalar,
    visit,
    YAMLMap,
} from "yaml";
import {
    BrunoFileType,
    BrunoVariableReference,
    BrunoVariableType,
    getPatternForVarsReadReferenceInNonCodeBlock,
    isScriptVarsSection,
    ItemType,
    Position,
    Range,
    TextDocumentHelper,
    VariableAvailabilityScopes,
    VariableReferenceType,
    VariableScopeSection,
    VariableScopeSectionKind,
} from "../../..";
import { getBrunoVariableReferencesInCodeBlock } from "../shared/codeBlocks/getBrunoVariableReferencesInCodeBlock";
import { getReadReferences } from "../../internal/variables/getBrunoVariableReferencesInNonCodeBlock";
import { getBlockScalarContentRange } from "./getBlockScalarContentRange";
import { getScriptBlocksFromYamlFile } from "./getScriptBlocksFromYamlFile";
import { ActionType } from "./constants/actionConstants";
import { ScriptType } from "./constants/sharedConstants";

/**
 * Syntax errors in the document are tolerated, so that the sections can also be determined while the user is typing.
 *
 * Read references (`{{var}}`) are only found in single-line plain/quoted scalars and in block scalars.
 * Scripts are only considered, if they are defined as literal block scalars or single-line plain scalars.
 */
export function getVariableScopeSectionsFromYamlFile(
    docHelper: TextDocumentHelper,
    itemType: ItemType,
): VariableScopeSection[] {
    if (!isItemTypeSupported(itemType)) {
        return [];
    }

    const lineCounter = new LineCounter();
    const document = parseDocument(docHelper.getText(), { lineCounter });
    const { contents } = document;
    const context: Context = { docHelper, lineCounter, itemType };

    return (
        isMap(contents) ? getSectionsFromMap(contents, context) : []
    ).concat(getScriptSections(docHelper, itemType, document));
}

interface Context {
    docHelper: TextDocumentHelper;
    lineCounter: LineCounter;
    itemType: ItemType;
}

function isItemTypeSupported(itemType: ItemType) {
    return (
        [
            BrunoFileType.RequestFile,
            BrunoFileType.FolderSettingsFile,
            BrunoFileType.CollectionSettingsFile,
        ] as ItemType[]
    ).includes(itemType);
}

function getScriptSections(
    docHelper: TextDocumentHelper,
    itemType: ItemType,
    parsedDocument: Document,
) {
    return getScriptBlocksFromYamlFile(docHelper, itemType, {
        parsedDocument,
        continueOnSyntaxErrors: true,
        includeSingleLinePlainScalars: true,
    }).blocks.map(
        ({ name, scriptType, contentRange }): VariableScopeSection => ({
            kind: mapScriptTypeToKind(scriptType),
            name,
            range: contentRange,
            variableReferences: getBrunoVariableReferencesInCodeBlock(
                docHelper,
                contentRange,
            ),
        }),
    );
}

function mapScriptTypeToKind(type: ScriptType) {
    switch (type) {
        case ScriptType.BeforeRequest:
            return VariableScopeSectionKind.PreRequestScript;
        case ScriptType.AfterResponse:
            return VariableScopeSectionKind.PostResponseScript;
        case ScriptType.Tests:
            return VariableScopeSectionKind.Tests;
    }
}

function getSectionsFromMap(root: YAMLMap, context: Context) {
    const isRequestFile = context.itemType == BrunoFileType.RequestFile;
    // In request files, the sections with variables are nested in `runtime`. In settings files, they are nested in `request`.
    const containerKey = isRequestFile ? "runtime" : "request";

    return root.items.flatMap(({ key, value }) => {
        const keyName = isScalar(key) ? String(key.value) : undefined;
        if (!keyName || (!isScalar(value) && !isMap(value) && !isSeq(value))) {
            return [];
        }

        if (keyName != containerKey) {
            return [
                createSection(
                    [keyName],
                    getKindForOtherTopLevelKey(keyName, isRequestFile),
                    value,
                    context,
                ),
            ];
        }

        return isMap(value)
            ? value.items.flatMap(({ key: subKey, value: subValue }) => {
                  const subKeyName = isScalar(subKey)
                      ? String(subKey.value)
                      : undefined;
                  const kind = subKeyName
                      ? getKindForContainerKey(subKeyName)
                      : undefined;

                  return subKeyName &&
                      kind != undefined &&
                      subValue &&
                      (isScalar(subValue) || isMap(subValue) || isSeq(subValue))
                      ? [
                            createSection(
                                [keyName, subKeyName],
                                kind,
                                subValue,
                                context,
                            ),
                        ]
                      : [];
              })
            : [];
    });
}

function getKindForOtherTopLevelKey(key: string, isRequestFile: boolean) {
    return isRequestFile &&
        !(["info", "settings", "docs", "examples", "app"] as string[]).includes(
            key,
        )
        ? VariableScopeSectionKind.Request
        : VariableScopeSectionKind.NoVariableSupport;
}

/** Scripts are not handled here, since they are handled separately. */
function getKindForContainerKey(key: string) {
    switch (key) {
        case "variables":
            return VariableScopeSectionKind.PreRequestVars;
        case "actions":
            return VariableScopeSectionKind.PostResponseVars;
        case "assertions":
            return VariableScopeSectionKind.Assertions;
        case "scripts":
            return undefined;
        default:
            return VariableScopeSectionKind.Request;
    }
}

function createSection(
    path: string[],
    kind: VariableScopeSectionKind,
    node: Node,
    context: Context,
): VariableScopeSection {
    const { lineCounter } = context;
    const range = node.range ?? [0, 0, 0];

    return {
        kind,
        name: path.join("."),
        range: new Range(
            toPosition(range[0], lineCounter),
            getEndOfContent(range[1], context),
        ),
        variableReferences:
            kind == VariableScopeSectionKind.NoVariableSupport
                ? []
                : isScriptVarsSection(kind)
                  ? getWriteReferences(node, kind, context).concat(
                        getReadReferencesInNode(node, context),
                    )
                  : getReadReferencesInNode(node, context),
    };
}

function getReadReferencesInNode(
    node: Node,
    { docHelper, lineCounter }: Context,
): BrunoVariableReference[] {
    const references: BrunoVariableReference[] = [];

    visit(node, {
        Scalar(_, scalar) {
            references.push(
                ...getReadReferencesInScalar(scalar, lineCounter, docHelper),
            );
        },
    });

    return references;
}

function getReadReferencesInScalar(
    scalar: Scalar,
    lineCounter: LineCounter,
    docHelper: TextDocumentHelper,
) {
    if (typeof scalar.value != "string" || !scalar.range) {
        return [];
    }

    const start = toPosition(scalar.range[0], lineCounter);
    const end = toPosition(scalar.range[1], lineCounter);
    const isBlockScalar =
        scalar.type == Scalar.BLOCK_LITERAL ||
        scalar.type == Scalar.BLOCK_FOLDED;
    const range = isBlockScalar
        ? getBlockScalarContentRange(start.line, end, docHelper)
        : new Range(start, end);

    if (!range) {
        return [];
    }

    const references = getReadReferences(docHelper, range);

    // Escape sequences in quoted scalars can make the text in the document differ from the actual value.
    return isBlockScalar ||
        haveSameNames(references, getReadReferencesInString(scalar.value))
        ? references
        : [];
}

function getReadReferencesInString(value: string) {
    return Array.from(
        value.matchAll(
            new RegExp(getPatternForVarsReadReferenceInNonCodeBlock(), "g"),
        ),
    ).map(([match]) => match.slice(2, -2));
}

function haveSameNames(references: BrunoVariableReference[], names: string[]) {
    return (
        references.length == names.length &&
        references.every(({ variableName }, i) => variableName == names[i])
    );
}

function getWriteReferences(
    node: Node,
    kind:
        | VariableScopeSectionKind.PreRequestVars
        | VariableScopeSectionKind.PostResponseVars,
    { docHelper, lineCounter, itemType }: Context,
): BrunoVariableReference[] {
    if (!isSeq(node)) {
        return [];
    }

    return node.items.flatMap((item) => {
        if (!isMap(item) || item.get("disabled") === true) {
            return [];
        }

        const nameNode =
            kind == VariableScopeSectionKind.PreRequestVars
                ? item.get("name", true)
                : item.get("type") == ActionType.SetVariable
                  ? item.getIn(["variable", "name"], true)
                  : undefined;

        if (
            !isScalar(nameNode) ||
            typeof nameNode.value != "string" ||
            !nameNode.range
        ) {
            return [];
        }

        const [startOffset, endOffset] = nameNode.range;
        const isQuoted =
            nameNode.type == Scalar.QUOTE_DOUBLE ||
            nameNode.type == Scalar.QUOTE_SINGLE;
        const start = toPosition(startOffset + (isQuoted ? 1 : 0), lineCounter);
        const end = toPosition(endOffset - (isQuoted ? 1 : 0), lineCounter);
        const variableNameRange = new Range(start, end);

        // Names that need to be escaped cannot be mapped reliably to the text in the document.
        if (
            start.line != end.line ||
            docHelper.getText(variableNameRange) != nameNode.value
        ) {
            return [];
        }

        return [
            {
                referenceType: VariableReferenceType.Write,
                variableName: nameNode.value,
                variableNameRange,
                variableType:
                    itemType == BrunoFileType.RequestFile
                        ? BrunoVariableType.Request
                        : BrunoVariableType.Folder,
                scope:
                    kind == VariableScopeSectionKind.PreRequestVars
                        ? VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
                        : VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants,
            },
        ];
    });
}

/** The end of the range of maps and sequences is the start of the line after their last line. */
function getEndOfContent(offset: number, { lineCounter, docHelper }: Context) {
    const end = toPosition(offset, lineCounter);

    return end.character == 0 && end.line > 0
        ? new Position(
              end.line - 1,
              docHelper.getLineByIndex(end.line - 1).length,
          )
        : end;
}

function toPosition(offset: number, lineCounter: LineCounter) {
    const { line, col } = lineCounter.linePos(offset);
    return new Position(line - 1, col - 1);
}
