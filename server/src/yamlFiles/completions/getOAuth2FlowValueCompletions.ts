import {
    BrunoFileType,
    getDescriptorsForText,
    getKeysForOAuth2Flow,
    getYamlDescriptorOfNestedMap,
    getYamlIndentationStep,
    LineBreakType,
    OAuth2AuthProperty,
    OAuth2Flow,
    Position,
    Range,
    TextDocumentHelper,
    YamlCursorContext,
    YamlMapDescriptor,
} from "@global_shared";
import {
    CompletionItem,
    InsertTextFormat,
    InsertTextMode,
    TextEdit,
} from "vscode-languageserver";
import {
    escapeForSnippet,
    KeyNode,
    renderKeys,
    RenderOptions,
} from "./renderYamlKeys";

type ValueContext = Extract<YamlCursorContext, { kind: "value" }>;
type DefinedKey = YamlMapDescriptor["definedKeys"][number];

/**
 * Completes the values for the `flow` of an `oauth2` auth.
 * Along with the value, the keys that are relevant for the flow but not defined yet are inserted.
 * Keys that are already defined are kept as they are. Missing keys of already defined nested maps (e.g. `credentials`) are added to them.
 *
 * @param toItem Creates the plain completion item for a value (without the keys of the flow).
 * @returns `undefined`, if the cursor is not at the `flow` value of an `oauth2` auth.
 */
export function getOAuth2FlowValueCompletions(
    context: ValueContext,
    {
        docHelper,
        fileType,
        toItem,
    }: {
        docHelper: TextDocumentHelper;
        fileType: BrunoFileType;
        toItem: (value: string) => CompletionItem;
    },
): CompletionItem[] | undefined {
    const { path, keyInfo, descriptor } = context;
    const [authKey, flowKey] = path.slice(-2);
    const flowDefinition = descriptor.definedKeys.find(
        ({ key }) => key == OAuth2AuthProperty.Flow,
    );

    // The `flow` key is only expected for an `oauth2` auth.
    if (
        authKey != "auth" ||
        flowKey != OAuth2AuthProperty.Flow ||
        !keyInfo?.allowedValues ||
        !flowDefinition
    ) {
        return undefined;
    }

    const lineBreak = docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf;
    const indentationStep = getYamlIndentationStep(docHelper);
    let descriptorsOfDocument: YamlMapDescriptor[] | undefined;

    const getEditForNestedMap = (
        parent: DefinedKey,
        childKeys: string[],
    ): TextEdit | undefined => {
        const { keyRange, valueRange } = parent;
        if (!valueRange) {
            return undefined;
        }

        if (valueRange.start.equals(valueRange.end)) {
            // The key has no value yet.
            return getInsertionAfterLine(
                docHelper,
                keyRange.end.line,
                childKeys,
                keyRange.start.character + indentationStep,
                lineBreak,
            );
        }

        const isFlowStyleOrScalar =
            valueRange.start.line == keyRange.start.line ||
            docHelper.getLineByIndex(valueRange.start.line)[
                valueRange.start.character
            ] == "{";
        if (isFlowStyleOrScalar) {
            // Not worth extending, since a scalar is reported as invalid anyways.
            return undefined;
        }

        descriptorsOfDocument ??= getDescriptorsForText(
            docHelper.getText(),
            fileType,
        );
        const nestedMap = getYamlDescriptorOfNestedMap(
            descriptorsOfDocument,
            parent,
        );
        const missingKeys = childKeys.filter((childKey) =>
            nestedMap?.definedKeys.every(({ key }) => key != childKey),
        );
        if (!nestedMap || missingKeys.length == 0) {
            return undefined;
        }

        const lastDefinedKey = nestedMap.definedKeys.reduce((last, current) =>
            current.keyRange.start.isBefore(last.keyRange.start)
                ? last
                : current,
        );
        return getInsertionAfterLine(
            docHelper,
            getLastLineOfEntry(lastDefinedKey),
            missingKeys,
            nestedMap.definedKeys[0].keyRange.start.character,
            lineBreak,
        );
    };

    const renderOptions: RenderOptions = {
        lineBreak,
        indentationStep,
        getDefaultValue: () => undefined,
    };

    return keyInfo.allowedValues.map((value) => {
        const item = toItem(value);
        if (!isOAuth2Flow(value)) {
            return item;
        }

        const missingNodes: KeyNode[] = [];
        const additionalTextEdits: TextEdit[] = [];

        for (const { key, childKeys } of getKeysForOAuth2Flow(value)) {
            const definedKey = descriptor.definedKeys.find(
                (defined) => defined.key == key,
            );

            if (!definedKey) {
                missingNodes.push(getNodeForKey(path, key, childKeys));
                continue;
            }

            const edit =
                childKeys && getEditForNestedMap(definedKey, childKeys);
            if (edit) {
                additionalTextEdits.push(edit);
            }
        }

        return {
            ...item,
            ...(missingNodes.length > 0
                ? {
                      textEdit: getTextEditForFlowAndKeys({
                          context,
                          flowColumn: flowDefinition.keyRange.start.character,
                          value,
                          missingNodes,
                          docHelper,
                          renderOptions,
                      }),
                      insertTextFormat: InsertTextFormat.Snippet,
                      // Otherwise, VS Code would add the indentation of the current line to all subsequent lines of the snippet.
                      insertTextMode: InsertTextMode.asIs,
                  }
                : {}),
            additionalTextEdits:
                additionalTextEdits.length > 0
                    ? additionalTextEdits
                    : undefined,
        };
    });
}

function isOAuth2Flow(value: string): value is OAuth2Flow {
    return (Object.values(OAuth2Flow) as string[]).includes(value);
}

function getNodeForKey(
    flowPath: string[],
    key: OAuth2AuthProperty,
    childKeys?: string[],
): KeyNode {
    const path = [...flowPath.slice(0, -1), key];

    return {
        keyInfo: {
            key,
            isMandatory: false,
            valueKinds: [childKeys ? "map" : "string"],
        },
        path,
        mandatoryChildKeys: childKeys?.map((childKey) => ({
            keyInfo: {
                key: childKey,
                isMandatory: false,
                valueKinds: ["string"],
            },
            path: [...path, childKey],
        })),
    };
}

/**
 * Replaces the value of the `flow` and inserts the missing keys in the lines below.
 * The edit starts in the line of the cursor (as required by the LSP) and includes everything up to the end of that line.
 */
function getTextEditForFlowAndKeys({
    context: { replaceRange, isMissingSpaceAfterColon },
    flowColumn,
    value,
    missingNodes,
    docHelper,
    renderOptions,
}: {
    context: ValueContext;
    flowColumn: number;
    value: string;
    missingNodes: KeyNode[];
    docHelper: TextDocumentHelper;
    renderOptions: RenderOptions;
}): TextEdit {
    const line = replaceRange.start.line;
    const lineContent = docHelper.getLineByIndex(line);
    const remainder = lineContent.substring(replaceRange.end.character);
    // A trailing comment needs to stay in the line of the `flow`.
    const commentToKeep = remainder.trim() ? remainder : "";

    return {
        range: new Range(
            replaceRange.start,
            new Position(line, lineContent.length),
        ),
        newText:
            (isMissingSpaceAfterColon ? " " : "") +
            value +
            escapeForSnippet(commentToKeep) +
            renderOptions.lineBreak +
            " ".repeat(flowColumn) +
            renderKeys(missingNodes, flowColumn, renderOptions),
    };
}

/** Additional text edits cannot contain snippet syntax, so the keys are inserted without tab stops. */
function getInsertionAfterLine(
    docHelper: TextDocumentHelper,
    line: number,
    keys: string[],
    column: number,
    lineBreak: LineBreakType,
): TextEdit {
    const position = new Position(line, docHelper.getLineByIndex(line).length);

    return {
        range: new Range(position, position),
        newText: keys
            .map((key) => `${lineBreak}${" ".repeat(column)}${key}: `)
            .join(""),
    };
}

/** For a multiline value (e.g. a block scalar), the range ends at the start of the line after its last line. */
function getLastLineOfEntry({ keyRange, valueRange }: DefinedKey) {
    const end = valueRange?.end ?? keyRange.end;

    return end.character == 0 && end.line > keyRange.start.line
        ? end.line - 1
        : end.line;
}
