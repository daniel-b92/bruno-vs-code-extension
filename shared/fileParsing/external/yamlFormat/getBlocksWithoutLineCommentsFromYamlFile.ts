import {
    isMap,
    isPair,
    isScalar,
    LineCounter,
    parseDocument,
    Scalar,
    visit,
} from "yaml";
import { Position, Range, TextDocumentHelper } from "../../..";
import { getBlockScalarContentRange } from "./getBlockScalarContentRange";

const typesWithoutLineComments = ["json", "xml", "html"];
const jsonKeys = ["variables", "message"];

/**
 * Returns the ranges of the block scalars in the given Yaml file content that contain a language without line comments (JSON, XML, HTML, Markdown).
 * The range contains the content lines of the block scalar (including the indentation), but not the header line.
 */
export function getBlocksWithoutLineCommentsFromYamlFile(
    fileContent: string,
): Range[] {
    const docHelper = new TextDocumentHelper(fileContent);
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
                    docHelper,
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
    docHelper: TextDocumentHelper,
) {
    if (!range) {
        return undefined;
    }

    const end = lineCounter.linePos(range[1]);

    return getBlockScalarContentRange(
        lineCounter.linePos(range[0]).line - 1,
        new Position(end.line - 1, end.col - 1),
        docHelper,
    );
}
