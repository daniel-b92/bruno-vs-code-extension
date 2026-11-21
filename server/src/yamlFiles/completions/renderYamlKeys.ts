import {
    LineBreakType,
    YamlExpectedKeyInfo,
    YamlValueKind,
} from "@global_shared";
import { escapeSnippetChoiceOption } from "../../shared/escapeSnippetChoiceOption";

export interface KeyNode {
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

export interface RenderOptions {
    lineBreak: LineBreakType;
    indentationStep: number;
    getDefaultValue: (path: string[]) => string | undefined;
    /**
     * For finding out the structure of nested maps, the insertion is rendered as plain Yaml (without snippet syntax).
     * The children of each node in the map are replaced by the respective probe key.
     */
    probes?: Map<KeyNode, string>;
}

export function isOnlyKind(kinds: YamlValueKind[], kind: YamlValueKind) {
    return kinds.length > 0 && kinds.every((k) => k == kind);
}

/**
 * The values to choose from for a scalar, if the value has to be one of them.
 * Not defined for keys that accept other scalar kinds as well (e.g. a number or the value `inherit`).
 */
export function getFixedScalarValues({
    valueKinds,
    allowedValues,
}: YamlExpectedKeyInfo) {
    if (isOnlyKind(valueKinds, "boolean")) {
        return ["true", "false"];
    }

    return isOnlyKind(valueKinds, "string") ? allowedValues : undefined;
}

/**
 * Renders the given keys, so that they can be inserted at the given column.
 * The first line has no indentation, subsequent lines have an absolute indentation.
 */
export function renderKeys(
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
    const { probes } = options;
    const probeKey = probes?.get(node);

    if (probeKey) {
        return `${probeKey}: x`;
    }

    if (node.mandatoryChildKeys?.length) {
        return renderKeys(node.mandatoryChildKeys, column, options, tabStops);
    }

    return probes ? "" : `$${tabStops.next++}`;
}

function renderScalarValue(
    { keyInfo, path }: KeyNode,
    { probes, getDefaultValue }: RenderOptions,
    tabStops: { next: number },
) {
    const { valueKinds, allowedValues } = keyInfo;
    const values = getFixedScalarValues(keyInfo);

    if (probes) {
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
        return `\${${tabStop}|${values.map(escapeSnippetChoiceOption).join(",")}|}`;
    }

    const defaultValue = getDefaultValue(path);
    return defaultValue
        ? `\${${tabStop}:${escapeForSnippet(defaultValue)}}`
        : `$${tabStop}`;
}

export function isMapOrSequence({ keyInfo: { valueKinds } }: KeyNode) {
    return isOnlyKind(valueKinds, "map") || isOnlyKind(valueKinds, "sequence");
}

function getLineStart(column: number, { lineBreak }: RenderOptions) {
    return `${lineBreak}${" ".repeat(column)}`;
}

export function escapeForSnippet(text: string) {
    return text.replace(/[$}\\]/g, "\\$&");
}
