import { TextDocument, Position as VsCodePosition } from "vscode";
import { LanguageFeatureRequestWithAdditionalData } from "../interfaces";
import { createSourceFile, ScriptTarget, SyntaxKind } from "typescript";
import { OutputChannelLogger, Range } from "../../../../../shared";

// ToDo: Find better name
export function getParameterNameForRequest({
    file: {
        blockContainingPosition: {
            content: blockContent,
            contentRange: blockContentRange,
            blockAsTsNode,
        },
    },
    request: { document, position, token },
    logger,
}: LanguageFeatureRequestWithAdditionalData) {
    const baseIdentifier = "bru";
    const functionName = "getEnvVar";

    if (
        !blockContent.includes(baseIdentifier) ||
        !blockContent.includes(functionName)
    ) {
        return undefined;
    }

    const offsetWithinSubdocument =
        document.offsetAt(position) -
        getDefaultOffsetForBlockContent(document, blockContentRange);

    const sourceFile = createSourceFile(
        "__temp.js",
        blockAsTsNode.getText(),
        ScriptTarget.ES2020,
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    let currentNode = blockAsTsNode;

    do {
        if (token.isCancellationRequested) {
            addLogEntryForCancellation(logger);
            return undefined;
        }

        const currentChildren = currentNode.getChildren(sourceFile);

        const childContainingPosition = currentChildren.find(
            (child) =>
                child.getStart(sourceFile) <= offsetWithinSubdocument &&
                child.getEnd() >= offsetWithinSubdocument,
        );

        if (!childContainingPosition) {
            addLogEntryForCancellation(logger);
            return undefined;
        }

        const neededDepthReached = currentNode
            .getChildren(sourceFile)
            .some((child) => {
                const childText = child.getText(sourceFile);
                return (
                    child.kind == SyntaxKind.PropertyAccessExpression &&
                    childText.startsWith(baseIdentifier) &&
                    childText.includes(".") &&
                    childText.endsWith(functionName)
                );
            });

        if (
            neededDepthReached &&
            childContainingPosition.kind == SyntaxKind.SyntaxList
        ) {
            const resultNode = childContainingPosition
                .getChildren(sourceFile)
                .find((child) =>
                    [
                        SyntaxKind.NoSubstitutionTemplateLiteral,
                        SyntaxKind.StringLiteral,
                    ].includes(child.kind),
                );

            return resultNode
                ? {
                      text: resultNode.getText(sourceFile),
                      start: document.positionAt(
                          getDefaultOffsetForBlockContent(
                              document,
                              blockContentRange,
                          ) + resultNode.getStart(sourceFile, true),
                      ),
                      end: document.positionAt(
                          getDefaultOffsetForBlockContent(
                              document,
                              blockContentRange,
                          ) + resultNode.getEnd(),
                      ),
                  }
                : undefined;
        }

        currentNode = childContainingPosition;
    } while (currentNode.getText(sourceFile).includes(functionName));

    return undefined;
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for language feature.`);
}

function getDefaultOffsetForBlockContent(
    document: TextDocument,
    blockContentRange: Range,
) {
    const firstContentLine = blockContentRange.start.line;

    return document.offsetAt(new VsCodePosition(firstContentLine - 1, 0));
}
