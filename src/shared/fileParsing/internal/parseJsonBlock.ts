import { createSourceFile, ScriptTarget, Node } from "typescript";
import { Position, Range, TextDocumentHelper, BlockBracket } from "../..";
import { getNonBlockSpecificBlockStartPattern } from "../external/shared/util/getNonBlockSpecificBlockStartPattern";

export function parseJsonBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
):
    | {
          content: string;
          contentRange: Range;
      }
    | undefined {
    const fullRemainingText = document.getTextStartingInLine(firstContentLine);

    const followingBlockStartIndex = fullRemainingText.search(
        getNonBlockSpecificBlockStartPattern(),
    );

    const blockContentEndIndex =
        followingBlockStartIndex < 0
            ? fullRemainingText.lastIndexOf(
                  BlockBracket.ClosingBracketForDictionaryOrTextBlock,
              )
            : fullRemainingText
                  .substring(0, followingBlockStartIndex)
                  .lastIndexOf(
                      BlockBracket.ClosingBracketForDictionaryOrTextBlock,
                  );

    const subDocument = new TextDocumentHelper(
        fullRemainingText.substring(0, blockContentEndIndex),
    );

    const sourceFile = createSourceFile(
        "__temp.json",
        subDocument.getText(),
        ScriptTarget.JSON,
    );

    const blockNode = (sourceFile as Node).getChildAt(0, sourceFile);

    if (
        !blockNode ||
        !blockNode
            .getText(sourceFile)
            .match(
                new RegExp(
                    `${BlockBracket.ClosingBracketForDictionaryOrTextBlock}\s*`,
                    "m",
                ),
            )
    ) {
        throw new Error(
            `Could not find JSON block within given subdocument: ${fullRemainingText}`,
        );
    }

    const blockContentEndInSubDocument = subDocument.getPositionForOffset(
        new Position(0, 0),
        blockContentEndIndex,
    );

    if (!blockContentEndInSubDocument) {
        return undefined;
    }

    const contentRange = new Range(
        new Position(firstContentLine, 0),
        new Position(
            firstContentLine + blockContentEndInSubDocument.line,
            blockContentEndInSubDocument.character,
        ),
    );

    return {
        content: document.getText(contentRange),
        contentRange,
    };
}
