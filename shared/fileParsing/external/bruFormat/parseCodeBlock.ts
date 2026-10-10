import {
    createSourceFile,
    FunctionExpression,
    isFunctionExpression,
    isVoidExpression,
    Node,
    ScriptTarget,
    isExpressionStatement,
} from "typescript";
import { BlockBracket, Position, Range, TextDocumentHelper } from "../../..";

export function parseCodeBlock(
    document: TextDocumentHelper,
    firstContentLine: number,
): { content: string; contentRange: Range } | undefined {
    const blockStartLine = firstContentLine - 1;

    const subDocument = new TextDocumentHelper(
        document.getTextStartingInLine(blockStartLine),
    );

    const sourceFile = createSourceFile(
        "__temp.js",
        subDocument.getText(),
        ScriptTarget.ES2020,
    );

    const blockNode = sourceFile.statements
        .map(getWrapperFunction)
        .find((fn) => fn != undefined);

    if (
        !blockNode ||
        !blockNode
            .getText(sourceFile)
            .match(
                new RegExp(
                    `${BlockBracket.ClosingBracketForDictionaryOrTextBlock}\\s*`,
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
    return {
        content: contentRange.start.equals(contentRange.end)
            ? ""
            : document.getText(contentRange), // `document.getText()` only works correctly, if the start and end position of the range are not the same.
        contentRange,
    };
}

/**
 * The code is wrapped like `void async function (...) { ... }`.
 * If the user's code is incomplete (e.g. an unbalanced `}`), the expression statement can extend beyond the closing bracket of the function (e.g. `void async function () {}\n(foo)`).
 * Therefore, the function expression itself is used to determine the end of the block.
 */
function getWrapperFunction(statement: Node): FunctionExpression | undefined {
    if (
        !isExpressionStatement(statement) ||
        !isVoidExpression(statement.expression)
    ) {
        return undefined;
    }

    let current: Node = statement.expression.expression;

    while (!isFunctionExpression(current)) {
        const leftmostChild = current.getChildren()[0];

        if (!leftmostChild) {
            return undefined;
        }

        current = leftmostChild;
    }

    return current;
}
