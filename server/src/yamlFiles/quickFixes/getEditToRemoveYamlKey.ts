import {
    Document,
    isMap,
    isPair,
    isScalar,
    Node,
    Pair,
    visit,
    YAMLMap,
} from "yaml";
import { TextEdit } from "vscode-languageserver";
import { ParsedYamlDocument } from "@global_shared";

export interface KeyRemoval {
    edit: TextEdit;
    /** Set if the parent key had to be removed as well, because it would have been left without a value. */
    removedParentKey?: string;
}

/**
 * Creates the edit that removes the key that starts at the given offset (including its value).
 * It is calculated based on the given text, so that it is always up to date.
 *
 * - If the parent map would be left empty, the parent key is removed instead (an empty value would be invalid).
 * - Keys in block style are removed with their whole lines. Keys in flow style (`{ a: 1, b: 2 }`) are removed together with a separator.
 *
 * @returns `undefined` if there is no key at the offset or if it cannot be removed safely.
 */
export function getEditToRemoveYamlKey(
    text: string,
    { document, lineCounter }: ParsedYamlDocument,
    keyOffset: number,
): KeyRemoval | undefined {
    const ancestors = findAncestorsOfKey(document, keyOffset);
    if (!ancestors) {
        return undefined;
    }
    const { pair, parents } = ancestors;
    const toRemove = findHighestPairToRemove(pair, parents);
    const offsets = getOffsetsToRemove(text, toRemove.pair, toRemove.map);

    return offsets
        ? {
              edit: TextEdit.del({
                  start: toLspPosition(offsets.start),
                  end: toLspPosition(offsets.end),
              }),
              removedParentKey:
                  toRemove.pair != pair
                      ? String(
                            isScalar(toRemove.pair.key)
                                ? toRemove.pair.key.value
                                : toRemove.pair.key,
                        )
                      : undefined,
          }
        : undefined;

    function toLspPosition(offset: number) {
        const { line, col } = lineCounter.linePos(offset);
        return { line: line - 1, character: col - 1 };
    }
}

type Ancestor = Document | Node | Pair;

/** The pair that starts with the key at the offset and its ancestors (outermost first). */
function findAncestorsOfKey(
    document: ParsedYamlDocument["document"],
    keyOffset: number,
) {
    let found: { pair: Pair; parents: readonly Ancestor[] } | undefined;

    visit(document, {
        Pair(_, pair, path) {
            if (isScalar(pair.key) && pair.key.range?.[0] == keyOffset) {
                found = { pair, parents: path };
                return visit.BREAK;
            }
        },
    });

    return found;
}

/** Walks up as long as the map would be empty after the removal and is the value of another key. */
function findHighestPairToRemove(pair: Pair, parents: readonly Ancestor[]) {
    let current: { pair: Pair; map: Ancestor } = {
        pair,
        map: parents[parents.length - 1],
    };
    let index = parents.length - 1;

    while (
        isMap(current.map) &&
        current.map.items.length == 1 &&
        isPair(parents[index - 1]) &&
        isMap(parents[index - 2])
    ) {
        current = {
            pair: parents[index - 1] as Pair,
            map: parents[index - 2],
        };
        index -= 2;
    }

    return current;
}

function getOffsetsToRemove(
    text: string,
    pair: Pair,
    map: Ancestor,
): { start: number; end: number } | undefined {
    if (!isMap(map) || !isScalar(pair.key) || !pair.key.range) {
        return undefined;
    }
    const keyStart = pair.key.range[0];

    return map.flow
        ? getOffsetsToRemoveFromFlowMap(pair, map)
        : getOffsetsToRemoveWholeLines(text, keyStart, getPairEnd(pair));
}

/** Removes the pair together with the separator to its neighbor. */
function getOffsetsToRemoveFromFlowMap(pair: Pair, map: YAMLMap) {
    const index = map.items.indexOf(pair as (typeof map.items)[number]);
    if (index < 0) {
        return undefined;
    }
    const { items } = map;

    if (index < items.length - 1) {
        return {
            start: getPairStart(pair),
            end: getPairStart(items[index + 1]),
        };
    }
    return index > 0
        ? { start: getPairEnd(items[index - 1]), end: getPairEnd(pair) }
        : { start: getPairStart(pair), end: getPairEnd(pair) };
}

function getOffsetsToRemoveWholeLines(
    text: string,
    keyStart: number,
    pairEnd: number,
) {
    const start = text.lastIndexOf("\n", keyStart - 1) + 1;
    // A key that shares its line with other content (e.g. `- key: value`) cannot be removed by removing the line.
    if (text.substring(start, keyStart).trim() != "") {
        return undefined;
    }
    // An end directly after a line break means that the following line does not belong to the key.
    let lastContentOffset = pairEnd;
    while (
        lastContentOffset > keyStart &&
        /[\r\n]/.test(text[lastContentOffset - 1])
    ) {
        lastContentOffset--;
    }
    const lineBreakIndex = text.indexOf("\n", lastContentOffset);

    return {
        start,
        end: lineBreakIndex < 0 ? text.length : lineBreakIndex + 1,
    };
}

function getPairStart(pair: Pair) {
    return (pair.key as { range: [number, number, number] }).range[0];
}

function getPairEnd(pair: Pair) {
    const keyEnd = (pair.key as { range: [number, number, number] }).range[1];
    const valueEnd = (pair.value as { range?: [number, number, number] } | null)
        ?.range?.[1];

    return Math.max(keyEnd, valueEnd ?? keyEnd);
}
