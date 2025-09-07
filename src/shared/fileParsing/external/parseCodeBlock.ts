import { createSourceFile, ScriptTarget, Node, SourceFile } from "typescript";
import { Position, Range, TextDocumentHelper } from "../..";

export function parseCodeBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
    callbackForGettingBlockNode: (sourceFile: SourceFile) => Node | undefined,
):
    | {
          content: string;
          contentRange: Range;
      }
    | undefined {
    const blockStartLine = firstContentLine - 1;

    const subDocument = new TextDocumentHelper(
        document.getTextStartingInLine(blockStartLine),
    );

    const sourceFile = createSourceFile(
        "__temp.js",
        subDocument.getText(),
        ScriptTarget.ES2020,
    );

    const blockNode = callbackForGettingBlockNode(sourceFile);

    if (!blockNode) {
        return undefined;
    }

    const fullBlockEndOffset = blockNode.end;

    const blockContentEndInSubDocument = subDocument.getPositionForOffset(
        new Position(0, 0),
        fullBlockEndOffset - 1,
    );

    if (!blockContentEndInSubDocument) {
        return undefined;
    }

    const contentRange = new Range(
        new Position(firstContentLine, 0),
        new Position(
            blockStartLine + blockContentEndInSubDocument.line,
            blockContentEndInSubDocument.character,
        ),
    );

    return {
        content: document.getText(contentRange),
        contentRange,
    };
}
