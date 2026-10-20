import {
    BrunoFileType,
    getYamlDescriptorForInsertedMap,
    getYamlIndentationStep,
    LineBreakType,
    TextDocumentHelper,
    YamlCursorContext,
    YamlExpectedKeyInfo,
    YamlMapDescriptor,
    YamlValueKind,
} from "@global_shared";
import {
    CompletionItem,
    CompletionItemKind,
    CompletionItemLabelDetails,
    InsertTextFormat,
    InsertTextMode,
} from "vscode-languageserver";

type KeyContext = Extract<YamlCursorContext, { kind: "key" }>;

interface KeyNode {
    keyInfo: YamlExpectedKeyInfo;
    /** The keys leading to this key, including the key itself. */
    path: string[];
    /**
     * For a map value (or a sequence of maps): the mandatory keys of the map (or of the first sequence item).
     * `undefined`, if they could not be determined.
     */
    mandatoryChildKeys?: KeyNode[];
    /**
     * Keys that can have a scalar value as well as a map or sequence value get a separate node for each kind.
     * Contains the index of this node among them and a short description of its kind.
     */
    variant?: { index: number; description: string };
}

interface RenderOptions {
    lineBreak: LineBreakType;
    indentationStep: number;
    getDefaultValue: (path: string[]) => string | undefined;
    /**
     * For finding out the structure of a nested map, the insertion is rendered as plain Yaml (without snippet syntax).
     * The children of the given node are replaced by the probe key.
     */
    probe?: { node: KeyNode; key: string };
}

/** Limits the number of nested maps for which the mandatory keys are inserted as well. */
const MAX_NESTING_DEPTH = 3;
const SUGGEST_COMMAND = {
    title: "Suggest",
    command: "editor.action.triggerSuggest",
};

/**
 * Provides a completion for every key that is missing in the map at the cursor.
 * For maps and sequences of maps, the mandatory keys of the nested map are inserted as well.
 * Keys that can have values of different kinds (e.g. a scalar or a map) get a separate completion for each kind.
 * If at least two mandatory keys are missing, an additional completion inserts all of them at once.
 *
 * @param getDefaultValue Returns the value to prefill for a mandatory key with the given path, if there is one.
 */
export function getKeyCompletions(
    context: KeyContext,
    {
        docHelper,
        fileType,
        getDefaultValue,
    }: {
        docHelper: TextDocumentHelper;
        fileType: BrunoFileType;
        getDefaultValue: (path: string[]) => string | undefined;
    },
): CompletionItem[] {
    const {
        descriptor: { expectedKeys, definedKeys },
        replaceRange,
        indentation,
        reindentationRange,
        path,
    } = context;
    const options: RenderOptions = {
        lineBreak: docHelper.getMostUsedLineBreak() ?? LineBreakType.Lf,
        indentationStep: getYamlIndentationStep(docHelper),
        getDefaultValue,
    };

    const nodes = expectedKeys
        .filter(({ key }) => definedKeys.every((defined) => defined.key != key))
        .flatMap((keyInfo) => {
            const variants = splitByValueKind(keyInfo);

            return variants.map((variantInfo, index) => {
                const node: KeyNode = {
                    keyInfo: variantInfo,
                    path: [...path, keyInfo.key],
                    variant:
                        variants.length > 1
                            ? {
                                  index,
                                  description: describeValueKind(variantInfo),
                              }
                            : undefined,
                };
                addMandatoryChildKeys(node, 0, (probedNode) =>
                    getYamlDescriptorForInsertedMap({
                        docHelper,
                        fileType,
                        context,
                        getInsertedText: (probeKey) =>
                            renderKeys([node], indentation, {
                                ...options,
                                probe: { node: probedNode, key: probeKey },
                            }),
                    }),
                );
                return node;
            });
        });

    const toItem = (
        text: string,
        isSnippet: boolean,
    ): Pick<
        CompletionItem,
        | "textEdit"
        | "additionalTextEdits"
        | "insertTextFormat"
        | "insertTextMode"
    > => ({
        textEdit: { range: replaceRange, newText: text },
        additionalTextEdits: reindentationRange
            ? [{ range: reindentationRange, newText: " ".repeat(indentation) }]
            : undefined,
        insertTextFormat: isSnippet ? InsertTextFormat.Snippet : undefined,
        // Otherwise, VS Code would add the indentation of the current line to all subsequent lines of the snippet.
        insertTextMode: InsertTextMode.asIs,
    });

    // Only the first variant of a key is used for inserting all mandatory keys at once.
    const mandatoryNodes = nodes.filter(
        ({ keyInfo, variant }) =>
            keyInfo.isMandatory && (variant?.index ?? 0) == 0,
    );
    const itemForAllMandatoryKeys: CompletionItem[] =
        mandatoryNodes.length > 1
            ? [
                  {
                      label: mandatoryNodes
                          .map(({ keyInfo: { key } }) => key)
                          .join(", "),
                      kind: CompletionItemKind.Snippet,
                      ...toItem(
                          renderKeys(mandatoryNodes, indentation, options),
                          true,
                      ),
                      // Sorted in front of the single mandatory keys (`a_<key>`).
                      sortText: "a",
                      labelDetails: { description: "all mandatory keys" },
                  },
              ]
            : [];

    return itemForAllMandatoryKeys.concat(
        nodes.map((node) => {
            const {
                keyInfo: { key, isMandatory },
                variant,
            } = node;
            const isScalar = !isMapOrSequence(node);

            return {
                label: key,
                kind: CompletionItemKind.Property,
                // For scalars, the value is only inserted, if there is just one allowed value.
                // Otherwise, the values are suggested via the value completions instead.
                ...toItem(
                    isScalar
                        ? `${key}: ${getOnlyAllowedValue(node) ?? ""}`
                        : renderKeys([node], indentation, options),
                    !isScalar,
                ),
                command: needsSuggestionAfterInsertion(node)
                    ? SUGGEST_COMMAND
                    : undefined,
                sortText: `${isMandatory ? "a" : "b"}_${key}${variant ? `_${variant.index}` : ""}`,
                labelDetails: getLabelDetails(node),
            };
        }),
    );
}

export function isOnlyKind(kinds: YamlValueKind[], kind: YamlValueKind) {
    return kinds.length > 0 && kinds.every((k) => k == kind);
}

/**
 * Splits a key that can have a scalar value as well as a map or sequence value into a key info for each kind.
 * The scalar kinds are kept together, since their values are inserted in the same way.
 * The allowed values only apply to the scalar kinds.
 */
function splitByValueKind(keyInfo: YamlExpectedKeyInfo): YamlExpectedKeyInfo[] {
    const { valueKinds, allowedValues, ...rest } = keyInfo;
    const scalarKinds = valueKinds.filter((kind) => !isContainerKind(kind));
    const containerKinds = valueKinds.filter(isContainerKind);

    if (containerKinds.length + (scalarKinds.length > 0 ? 1 : 0) < 2) {
        return [keyInfo];
    }

    return [
        ...(scalarKinds.length > 0
            ? [{ ...keyInfo, valueKinds: scalarKinds }]
            : []),
        ...containerKinds.map((kind) => ({ ...rest, valueKinds: [kind] })),
    ];
}

/** For a scalar with a single allowed value, the value is used as description, since it is inserted along with the key. */
function describeValueKind(keyInfo: YamlExpectedKeyInfo) {
    const { valueKinds, allowedValues } = keyInfo;
    return allowedValues?.length == 1
        ? allowedValues[0]
        : valueKinds.join(" | ");
}

function getLabelDetails({
    keyInfo: { isMandatory },
    variant,
}: KeyNode): CompletionItemLabelDetails | undefined {
    if (isMandatory && !variant) {
        return undefined;
    }

    return {
        ...(isMandatory ? {} : { detail: " optional" }),
        ...(variant ? { description: variant.description } : {}),
    };
}

/**
 * Suggestions are triggered for the value of a scalar that is not inserted along with the key but has suggested values,
 * and for the content of a map or sequence, if no mandatory keys have been inserted for it.
 */
function needsSuggestionAfterInsertion(node: KeyNode) {
    const {
        keyInfo: { allowedValues },
        mandatoryChildKeys,
    } = node;

    return isMapOrSequence(node)
        ? !mandatoryChildKeys?.length
        : getOnlyAllowedValue(node) === undefined &&
              ((allowedValues?.length ?? 0) > 0 ||
                  isOnlyKind(node.keyInfo.valueKinds, "boolean"));
}

/**
 * The values to choose from for a scalar, if the value has to be one of them.
 * Not defined for keys that accept other scalar kinds as well (e.g. a number or the value `inherit`).
 */
function getFixedScalarValues({
    valueKinds,
    allowedValues,
}: YamlExpectedKeyInfo) {
    if (isOnlyKind(valueKinds, "boolean")) {
        return ["true", "false"];
    }

    return isOnlyKind(valueKinds, "string") ? allowedValues : undefined;
}

function getOnlyAllowedValue({ keyInfo }: KeyNode) {
    const values = getFixedScalarValues(keyInfo);
    return values?.length == 1 ? values[0] : undefined;
}

/**
 * Determines the mandatory keys of a map value (or a sequence of maps) and recursively the ones of their nested maps.
 * The child nodes are added to the tree one by one, because finding out the keys of a nested map requires rendering the tree up to that map.
 */
function addMandatoryChildKeys(
    node: KeyNode,
    depth: number,
    getDescriptorForChildren: (node: KeyNode) => YamlMapDescriptor | undefined,
) {
    if (depth >= MAX_NESTING_DEPTH || !isMapOrSequence(node)) {
        return;
    }

    const descriptor = getDescriptorForChildren(node);
    if (!descriptor) {
        // E.g. for a sequence of scalars.
        return;
    }

    node.mandatoryChildKeys = [];
    for (const keyInfo of descriptor.expectedKeys.filter(
        ({ isMandatory }) => isMandatory,
    )) {
        // For a key with values of different kinds, the first variant is inserted.
        const child: KeyNode = {
            keyInfo: splitByValueKind(keyInfo)[0],
            path: [...node.path, keyInfo.key],
        };
        node.mandatoryChildKeys.push(child);
        addMandatoryChildKeys(child, depth + 1, getDescriptorForChildren);
    }
}

/**
 * Renders the given keys, so that they can be inserted at the given column.
 * The first line has no indentation, subsequent lines have an absolute indentation.
 */
function renderKeys(
    nodes: KeyNode[],
    column: number,
    options: RenderOptions,
    tabStops = { next: 1 },
): string {
    return nodes
        .map((node) => renderKey(node, column, options, tabStops))
        .join(getLineStart(column, options));
}

function renderKey(
    node: KeyNode,
    column: number,
    options: RenderOptions,
    tabStops: { next: number },
): string {
    const {
        keyInfo: { key, valueKinds },
    } = node;
    const childColumn = column + options.indentationStep;

    if (isOnlyKind(valueKinds, "map")) {
        return `${key}:${getLineStart(childColumn, options)}${renderChildren(node, childColumn, options, tabStops)}`;
    }

    if (isOnlyKind(valueKinds, "sequence")) {
        // The keys of a sequence item start after the leading `- `.
        return `${key}:${getLineStart(childColumn, options)}- ${renderChildren(node, childColumn + 2, options, tabStops)}`;
    }

    return `${key}: ${renderScalarValue(node, options, tabStops)}`;
}

function renderChildren(
    node: KeyNode,
    column: number,
    options: RenderOptions,
    tabStops: { next: number },
) {
    const { probe } = options;

    if (probe?.node == node) {
        return `${probe.key}: x`;
    }

    if (node.mandatoryChildKeys?.length) {
        return renderKeys(node.mandatoryChildKeys, column, options, tabStops);
    }

    return probe ? "" : `$${tabStops.next++}`;
}

function renderScalarValue(
    { keyInfo, path }: KeyNode,
    { probe, getDefaultValue }: RenderOptions,
    tabStops: { next: number },
) {
    const { valueKinds, allowedValues } = keyInfo;
    const values = getFixedScalarValues(keyInfo);

    if (probe) {
        return (
            allowedValues?.[0] ??
            values?.[0] ??
            (isOnlyKind(valueKinds, "number") ? "0" : "x")
        );
    }

    if (values?.length == 1) {
        return escapeForSnippet(values[0]);
    }

    const tabStop = tabStops.next++;

    if (values) {
        return `\${${tabStop}|${values.map(escapeForSnippetChoice).join(",")}|}`;
    }

    const defaultValue = getDefaultValue(path);
    return defaultValue
        ? `\${${tabStop}:${escapeForSnippet(defaultValue)}}`
        : `$${tabStop}`;
}

function isMapOrSequence({ keyInfo: { valueKinds } }: KeyNode) {
    return isOnlyKind(valueKinds, "map") || isOnlyKind(valueKinds, "sequence");
}

function isContainerKind(kind: YamlValueKind) {
    return kind == "map" || kind == "sequence";
}

function getLineStart(column: number, { lineBreak }: RenderOptions) {
    return `${lineBreak}${" ".repeat(column)}`;
}

function escapeForSnippet(text: string) {
    return text.replace(/[$}\\]/g, "\\$&");
}

function escapeForSnippetChoice(text: string) {
    return text.replace(/[$}\\,|]/g, "\\$&");
}
