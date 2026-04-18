import { BlockBracket, Position, TextDocumentHelper } from "../..";

export function findBlockEnd(
    documentHelper: TextDocumentHelper,
    firstContentLine: number,
    shouldBeArrayBlock: boolean,
) {
    const blockEndBracket = shouldBeArrayBlock
        ? BlockBracket.ClosingBracketForArrayBlock
        : BlockBracket.ClosingBracketForDictionaryOrTextBlock;

    const line =
        firstContentLine >= documentHelper.getLineCount()
            ? undefined
            : documentHelper
                  .getAllLines(firstContentLine)
                  .find(({ content }) => {
                      const patternMatches = content.match(
                          getBlockEndPattern(blockEndBracket),
                      );
                      return patternMatches && patternMatches.length > 0;
                  });

    return line ? new Position(line.index, 0) : undefined;
}

function getBlockEndPattern(blockEndBracket: BlockBracket) {
    return new RegExp(`^${blockEndBracket}\\s*$`, "m");
}
