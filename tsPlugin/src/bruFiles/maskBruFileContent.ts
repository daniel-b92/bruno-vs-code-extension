import {
    getCodeBlockIndizesForBruFile,
    isGrpcRequestFile,
} from "../codeBlocks/bruCodeBlocks";
import { isLineBreak, maskContent } from "../codeBlocks/maskContent";
import { getBlockWrapperCandidates } from "./getBlockWrapperCandidates";

/**
 * Returns the content of a `.bru` file the way it should be seen by the Typescript server.
 *
 * All characters that are not part of a code block are replaced by spaces, so that the Typescript server does not try to interpret them as code.
 * Line breaks are kept and nothing is inserted into the file, so that all offsets and line / character positions are equal to the ones in the original content.
 * Instead, each code block is wrapped by overwriting the characters in front of its opening bracket (see `getBlockWrapperCandidates`).
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

        const wrapperPlacements = getPlacementsForFirstFittingWrapper(
            getBlockWrapperCandidates(blockName, isGrpcRequest),
            getSpacesBeforeIndex(
                fileContent,
                firstFreeIndex,
                openingBracketIndex,
            ),
        );

        for (const { index, token } of wrapperPlacements) {
            for (const [offset, character] of [...token].entries()) {
                maskedCharacters[index + offset] = character;
            }
        }

        firstFreeIndex = endIndex;
    }

    return maskedCharacters.join("").concat(suffix);
}

interface Space {
    /** Inclusive. */
    startIndex: number;
    /** Exclusive. */
    endIndex: number;
}

/**
 * Returns the continuous spaces without line breaks in the given range. The last space ends with the character at the end index.
 */
function getSpacesBeforeIndex(
    fileContent: string,
    startIndex: number,
    lastIndex: number,
) {
    const spaces: Space[] = [];
    let spaceStart = startIndex;

    for (let i = startIndex; i <= lastIndex; i++) {
        if (isLineBreak(fileContent[i])) {
            if (i > spaceStart) {
                spaces.push({ startIndex: spaceStart, endIndex: i });
            }
            spaceStart = i + 1;
        }
    }

    if (lastIndex + 1 > spaceStart) {
        spaces.push({ startIndex: spaceStart, endIndex: lastIndex + 1 });
    }

    return spaces;
}

function getPlacementsForFirstFittingWrapper(
    wrapperCandidates: string[][],
    spaces: Space[],
) {
    for (const tokens of wrapperCandidates) {
        const placements = placeTokens(tokens, spaces);

        if (placements) {
            return placements;
        }
    }

    // The last wrapper candidate only consists of the opening bracket, which always fits.
    return [];
}

/**
 * The tokens are assigned to the spaces as late as possible, so that the last token ends directly at the end of the last space.
 * A token is never split up, but different tokens can be placed on different lines.
 * Tokens that are placed on the same line are separated by a space.
 *
 * The Typescript server indents new lines within the wrapped code relative to the line that the wrapper function starts on.
 * Therefore, the first token of a line is always placed at the start of the line, unless it is the only token for the last space (which needs to end at the opening bracket).
 */
function placeTokens(tokens: string[], spaces: Space[]) {
    return assignTokensToSpaces(tokens, spaces)?.flatMap(
        ({ space, tokens: tokensInSpace }) => {
            const [firstToken, ...otherTokens] = tokensInSpace;

            return space == spaces[spaces.length - 1]
                ? otherTokens.length > 0
                    ? [
                          { index: space.startIndex, token: firstToken },
                          ...placeTokensRightAligned(
                              otherTokens,
                              space.endIndex,
                          ),
                      ]
                    : placeTokensRightAligned([firstToken], space.endIndex)
                : placeTokensLeftAligned(tokensInSpace, space.startIndex);
        },
    );
}

function assignTokensToSpaces(tokens: string[], spaces: Space[]) {
    const tokensPerSpace: { space: Space; tokens: string[] }[] = [];
    let spaceIndex = spaces.length - 1;
    let end = spaces[spaceIndex]?.endIndex;

    for (const token of [...tokens].reverse()) {
        while (
            spaceIndex >= 0 &&
            end - token.length < spaces[spaceIndex].startIndex
        ) {
            spaceIndex--;
            end = spaces[spaceIndex]?.endIndex;
        }

        if (spaceIndex < 0) {
            return undefined;
        }

        end -= token.length + 1;

        if (tokensPerSpace[0]?.space == spaces[spaceIndex]) {
            tokensPerSpace[0].tokens.unshift(token);
        } else {
            tokensPerSpace.unshift({
                space: spaces[spaceIndex],
                tokens: [token],
            });
        }
    }

    return tokensPerSpace;
}

function placeTokensLeftAligned(tokens: string[], startIndex: number) {
    let index = startIndex;

    return tokens.map((token) => {
        const placement = { index, token };
        index += token.length + 1;

        return placement;
    });
}

function placeTokensRightAligned(tokens: string[], endIndex: number) {
    let end = endIndex;

    return [...tokens].reverse().map((token) => {
        const placement = { index: end - token.length, token };
        end = placement.index - 1;

        return placement;
    });
}
