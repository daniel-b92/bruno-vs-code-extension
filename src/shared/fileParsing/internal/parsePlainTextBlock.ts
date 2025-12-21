import { Position, Range, TextDocumentHelper, BlockBracket } from "../..";

export function parsePlainTextBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
):
    | {
          content: string;
          contentRange: Range;
      }
    | undefined {
    const patternForBlockEnd = new RegExp(
        `^\\s*${BlockBracket.ClosingBracketForDictionaryOrTextBlock}\\s*$`,
        "m",
    );

    let blockEndPosition: Position | undefined = undefined;

    document.getAllLines(firstContentLine).find(({ content, index }) => {
        const patternMatches = content.match(patternForBlockEnd);

        if (patternMatches && patternMatches.length > 0) {
            blockEndPosition = new Position(
                index,
                content.indexOf(
                    BlockBracket.ClosingBracketForDictionaryOrTextBlock,
                ),
            );

            return true;
        }

        return false;
    });

    if (!blockEndPosition) {
        return undefined;
    }

    const contentRange = new Range(
        new Position(firstContentLine, 0),
        blockEndPosition,
    );

    return { content: document.getText(contentRange), contentRange };
}
