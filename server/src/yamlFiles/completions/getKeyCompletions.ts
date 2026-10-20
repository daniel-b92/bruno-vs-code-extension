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
        .map((keyInfo) => {
            const node: KeyNode = { keyInfo, path: [...path, keyInfo.key] };
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

    const mandatoryNodes = nodes.filter(({ keyInfo }) => keyInfo.isMandatory);
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
            } = node;
            const isScalar = !isMapOrSequence(node);

            return {
                label: key,
                kind: CompletionItemKind.Property,
                // For scalars, the values are suggested via the value completions instead.
                ...toItem(
                    isScalar
                        ? `${key}: `
                        : renderKeys([node], indentation, options),
                    !isScalar,
                ),
                command: needsSuggestionAfterInsertion(node)
                    ? SUGGEST_COMMAND
                    : undefined,
                sortText: isMandatory ? `a_${key}` : `b_${key}`,
                labelDetails: isMandatory ? undefined : { detail: " optional" },
            };
        }),
    );
}

export function isOnlyKind(kinds: YamlValueKind[], kind: YamlValueKind) {
    return kinds.length > 0 && kinds.every((k) => k == kind);
}

/**
 * Suggestions are triggered for the value of a scalar with a fixed set of values,
 * and for the content of a map or sequence, if no mandatory keys have been inserted for it.
 */
function needsSuggestionAfterInsertion(node: KeyNode) {
    const {
        keyInfo: { valueKinds, allowedValues },
        mandatoryChildKeys,
    } = node;

    return isMapOrSequence(node)
        ? !mandatoryChildKeys?.length
        : (allowedValues?.length ?? 0) > 0 || isOnlyKind(valueKinds, "boolean");
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
        const child: KeyNode = { keyInfo, path: [...node.path, keyInfo.key] };
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
    { keyInfo: { valueKinds, allowedValues }, path }: KeyNode,
    { probe, getDefaultValue }: RenderOptions,
    tabStops: { next: number },
) {
    const values =
        allowedValues ??
        (isOnlyKind(valueKinds, "boolean") ? ["true", "false"] : undefined);

    if (probe) {
        return values?.[0] ?? (isOnlyKind(valueKinds, "number") ? "0" : "x");
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

function getLineStart(column: number, { lineBreak }: RenderOptions) {
    return `${lineBreak}${" ".repeat(column)}`;
}

function escapeForSnippet(text: string) {
    return text.replace(/[$}\\]/g, "\\$&");
}

function escapeForSnippetChoice(text: string) {
    return text.replace(/[$}\\,|]/g, "\\$&");
}
