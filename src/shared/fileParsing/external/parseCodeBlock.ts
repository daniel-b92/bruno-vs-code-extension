import { createSourceFile, Node, ScriptTarget, SyntaxKind } from "typescript";
import {
    BlockBracket,
    CodeBlockContent,
    Position,
    Range,
    TextDocumentHelper,
} from "../..";

export function parseCodeBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
    blockSyntaxKind: SyntaxKind,
): { content: CodeBlockContent; contentRange: Range } | undefined {
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
        .find(({ kind }) => kind == blockSyntaxKind);

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
    const blockContentNode = blockNode
        .getChildren(sourceFile)
        .find((node) => node.kind == SyntaxKind.SyntaxList);

    return blockContentNode != undefined
        ? {
              content: {
                  asPlainText: contentRange.start.equals(contentRange.end)
                      ? ""
                      : document.getText(contentRange), // `document.getText()` only works correctly, if the start and end position of the range are not the same.
                  asTsNode: blockContentNode,
              },
              contentRange,
          }
        : undefined;
}
