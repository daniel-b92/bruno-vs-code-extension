import { createSourceFile, ScriptTarget, Node, SyntaxKind } from "typescript";
import { Position, Range, TextDocumentHelper } from "../..";

export function parseCodeBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
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

    const blockNode = (sourceFile as Node)
        .getChildAt(0, sourceFile)
        .getChildren(sourceFile)
        .find(({ kind }) => kind == SyntaxKind.Block);

    if (!blockNode) {
        throw new Error(
            `Could not find code block within given subdocument: ${subDocument.getText()}`,
        );
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
