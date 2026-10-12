import { isMap, isScalar, isSeq, parseDocument, Scalar } from "yaml";

/**
 * Returns the content of a Yaml file from a Bruno collection the way it should be seen by the Typescript server.
 *
 * All characters that are not part of a script's code are replaced by spaces.
 * Line breaks are kept, so that all offsets and line / character positions are equal to the ones in the original content.
 * Each script is wrapped in a block (`{ ... }`), so that its declarations are scoped like the ones in code blocks of `.bru` files.
 *
 * Only scripts defined as literal block scalars (`code: |`) are kept.
 * For all other scalar styles, the raw text in the file is not equal to the code (e.g. due to quotes or line folding).
 */
export function maskYamlCollectionFileContent(fileContent: string) {
    const maskedCharacters = maskYamlFileContent(fileContent).split("");
    const scriptRanges = getScriptContentRanges(fileContent);
    let firstFreeIndex = 0;
    let suffix = "";

    for (const [index, { start, end }] of scriptRanges.entries()) {
        const isLastScript = index == scriptRanges.length - 1;

        const openingBracketIndex = findLastIndexWithoutLineBreak(
            fileContent,
            firstFreeIndex,
            start,
        );
        const closingBracketIndex = findFirstIndexWithoutLineBreak(
            fileContent,
            end,
            isLastScript ? fileContent.length : scriptRanges[index + 1].start,
        );

        if (
            openingBracketIndex == undefined ||
            (closingBracketIndex == undefined && !isLastScript)
        ) {
            continue;
        }

        for (let i = start; i < end; i++) {
            maskedCharacters[i] = fileContent[i];
        }

        maskedCharacters[openingBracketIndex] = "{";

        if (closingBracketIndex == undefined) {
            // Appending a character at the end does not shift any positions.
            suffix = "}";
        } else {
            maskedCharacters[closingBracketIndex] = "}";
            firstFreeIndex = closingBracketIndex + 1;
        }
    }

    return maskedCharacters.join("").concat(suffix);
}

/**
 * Replaces all characters except for line breaks by spaces, so that the Typescript server does not provide any language features for the file.
 */
export function maskYamlFileContent(fileContent: string) {
    return fileContent.replace(/[^\r\n\u2028\u2029]/g, " ");
}

/**
 * Scripts are defined in `runtime.scripts` for request files and in `request.scripts` for folder and collection settings files.
 */
function getScriptContentRanges(fileContent: string) {
    const document = parseDocument(fileContent);

    return [
        document.getIn(["runtime", "scripts"], true),
        document.getIn(["request", "scripts"], true),
    ]
        .flatMap((scripts) => (isSeq(scripts) ? scripts.items : []))
        .flatMap((script) => {
            const code = isMap(script) ? script.get("code", true) : undefined;

            if (
                !isScalar(code) ||
                code.type != Scalar.BLOCK_LITERAL ||
                !code.range
            ) {
                return [];
            }

            const [headerStart, valueEnd] = code.range;
            const range = getContentRangeForBlockScalar(
                fileContent,
                headerStart,
                valueEnd,
            );

            return range ? [range] : [];
        })
        .sort(({ start: start1 }, { start: start2 }) => start1 - start2);
}

/**
 * The range of a block scalar node starts with the header (e.g. `|-`), which is followed by the content on the next lines.
 */
function getContentRangeForBlockScalar(
    fileContent: string,
    headerStart: number,
    valueEnd: number,
) {
    const lineBreakAfterHeader = /\r\n|\r|\n|\u2028|\u2029/g;
    lineBreakAfterHeader.lastIndex = headerStart;
    const match = lineBreakAfterHeader.exec(fileContent);

    if (!match) {
        return undefined;
    }

    const start = match.index + match[0].length;

    return start < valueEnd ? { start, end: valueEnd } : undefined;
}

function findLastIndexWithoutLineBreak(
    text: string,
    startIndex: number,
    endIndexExclusive: number,
) {
    for (let i = endIndexExclusive - 1; i >= startIndex; i--) {
        if (!isLineBreak(text[i])) {
            return i;
        }
    }

    return undefined;
}

function findFirstIndexWithoutLineBreak(
    text: string,
    startIndex: number,
    endIndexExclusive: number,
) {
    for (let i = startIndex; i < endIndexExclusive; i++) {
        if (!isLineBreak(text[i])) {
            return i;
        }
    }

    return undefined;
}

function isLineBreak(character: string) {
    return ["\r", "\n", "\u2028", "\u2029"].includes(character);
}
