import { Position, Range, BlockBracket } from "../../../..";

export function getContentRangeForArrayOrDictionaryBlock(
    firstLineIndex: number,
    closingBracket: BlockBracket,
    lineWithClosingBracketIndex: number,
    lastLineContent: string,
) {
    return new Range(
        new Position(firstLineIndex, 0),
        new Position(
            lineWithClosingBracketIndex,
            lastLineContent.lastIndexOf(closingBracket),
        ),
    );
}
