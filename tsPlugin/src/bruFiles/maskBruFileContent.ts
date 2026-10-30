import {
    getCodeBlockIndizesForBruFile,
    isGrpcRequestFile,
} from "../codeBlocks/bruCodeBlocks";
import { maskContent } from "../codeBlocks/maskContent";
import { wrapCodeBlock } from "../codeBlocks/wrapCodeBlock";

/**
 * Returns the content of a `.bru` file the way it should be seen by the Typescript server.
 *
 * All characters that are not part of a code block are replaced by spaces, so that the Typescript server does not try to interpret them as code.
 * Line breaks are kept and nothing is inserted into the file, so that all offsets and line / character positions are equal to the ones in the original content.
 * Instead, each code block is wrapped by overwriting the characters in front of its opening bracket (see `wrapCodeBlock`).
 */
export function maskBruFileContent(fileContent: string) {
    const maskedCharacters = maskContent(fileContent).split("");
    const isGrpcRequest = isGrpcRequestFile(fileContent);
    const codeBlocks = getCodeBlockIndizesForBruFile(fileContent).sort(
        ({ startIndex: start1 }, { startIndex: start2 }) => start1 - start2,
    );
    let firstFreeIndex = 0;
    let suffix = "";

    for (const { blockName, startIndex, endIndex } of codeBlocks) {
        const openingBracketIndex = startIndex - 1;

        // Blocks without a closing bracket include the rest of the file, so they could overlap with other blocks.
        if (openingBracketIndex < firstFreeIndex) {
            continue;
        }

        const hasClosingBracket = fileContent[endIndex - 1] == "}";
        const endOfCodeIndex = hasClosingBracket ? endIndex - 1 : endIndex;

        for (let i = startIndex; i < endOfCodeIndex; i++) {
            maskedCharacters[i] = fileContent[i];
        }

        if (hasClosingBracket) {
            maskedCharacters[endOfCodeIndex] = "}";
        } else {
            // Appending characters at the end does not shift any positions.
            // A line break is needed since the closing bracket could otherwise be part of a line comment.
            suffix = "\n}";
        }

        wrapCodeBlock(maskedCharacters, {
            blockName,
            isGrpcRequest,
            code: fileContent.substring(startIndex, endOfCodeIndex),
            fileContent,
            firstFreeIndex,
            openingBracketIndex,
        });

        firstFreeIndex = endIndex;
    }

    return maskedCharacters.join("").concat(suffix);
}
