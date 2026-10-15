import {
    isMap,
    isPair,
    isScalar,
    LineCounter,
    parseDocument,
    Scalar,
    visit,
} from "yaml";
import { Position, Range } from "../../..";

const typesWithoutLineComments = ["json", "xml", "html"];
const jsonKeys = ["variables", "message"];

/**
 * Returns the ranges of the block scalars in the given Yaml file content that contain a language without line comments (JSON, XML, HTML, Markdown).
 * The range contains the content lines of the block scalar (including the indentation), but not the header line.
 */
export function getBlocksWithoutLineCommentsFromYamlFile(
    fileContent: string,
): Range[] {
    const lineCounter = new LineCounter();
    const document = parseDocument(fileContent, { lineCounter });

    if (document.errors.length > 0) {
        return [];
    }

    const ranges: Range[] = [];

    visit(document, {
        Pair(_, pair, path) {
            const key = isScalar(pair.key) ? pair.key.value : undefined;
            const parentMap = path[path.length - 1];
            const parentPair = path[path.length - 2];

            if (!isBlockScalar(pair.value) || !isMap(parentMap)) {
                return;
            }

            const isTopLevel = path.length == 2;
            const parentKey =
                isPair(parentPair) && isScalar(parentPair.key)
                    ? parentPair.key.value
                    : undefined;
            const isAppCode =
                key == "code" && (isTopLevel || parentKey == "app");
            const isDocs =
                (key == "docs" && isTopLevel) ||
                (key == "content" && parentKey == "docs");
            const isJsonKey = jsonKeys.includes(String(key));
            const isTypedData =
                key == "data" &&
                typesWithoutLineComments.includes(
                    String(parentMap.get("type")),
                );

            if (isAppCode || isDocs || isJsonKey || isTypedData) {
                const range = getContentRange(
                    pair.value.range,
                    lineCounter,
                    fileContent,
                );
                if (range) {
                    ranges.push(range);
                }
            }
        },
    });

    return ranges;
}

function isBlockScalar(node: unknown): node is Scalar {
    return (
        isScalar(node) &&
        (node.type == Scalar.BLOCK_LITERAL || node.type == Scalar.BLOCK_FOLDED)
    );
}

function getContentRange(
    range: [number, number, number] | null | undefined,
    lineCounter: LineCounter,
    fileContent: string,
) {
    if (!range) {
        return undefined;
    }

    const headerLine = lineCounter.linePos(range[0]).line - 1;
    const end = lineCounter.linePos(range[1]);
    // The range of a block scalar usually ends at the start of the line following the content.
    const lastLine = end.col == 1 ? end.line - 2 : end.line - 1;
    const firstLine = headerLine + 1;

    if (lastLine < firstLine) {
        return undefined;
    }

    return new Range(
        new Position(firstLine, 0),
        new Position(lastLine, fileContent.split("\n")[lastLine].length),
    );
}
