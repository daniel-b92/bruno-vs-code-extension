import { BlockBracket, Position, Range, TextDocumentHelper } from "../..";

export function parsePlainTextBlock(
    docHelper: TextDocumentHelper,
    firstContentLine: number,
    lastContentLine: number,
) {
    const blockEndCharacter = docHelper
        .getLineByIndex(lastContentLine + 1)
        .lastIndexOf(BlockBracket.ClosingBracketForDictionaryOrTextBlock);
    const contentRange = new Range(
        new Position(firstContentLine, 0),
        new Position(lastContentLine + 1, blockEndCharacter),
    );

    return {
        content: docHelper.getText(contentRange),
        contentRange,
    };
}
