import { BlockBracket, BlockType, Position, TextDocumentHelper } from "../..";

export function findBlockEnd(
    documentHelper: TextDocumentHelper,
    firstContentLine: number,
    blockType: BlockType,
) {
    const blockEndBracket = getBlockEndBracketForBlockType(blockType);

    const line = documentHelper
        .getAllLines(firstContentLine)
        .find(({ content }) => {
            const patternMatches = content.match(
                getBlockEndPattern(blockEndBracket),
            );
            return patternMatches && patternMatches.length > 0;
        });

    return line ? new Position(line.index, 0) : undefined;
}

function getBlockEndBracketForBlockType(blockType: BlockType) {
    return blockType == BlockType.Array
        ? BlockBracket.ClosingBracketForArrayBlock
        : BlockBracket.ClosingBracketForDictionaryOrTextBlock;
}

function getBlockEndPattern(blockEndBracket: BlockBracket) {
    return new RegExp(`^${blockEndBracket}\\s*$`, "m");
}
