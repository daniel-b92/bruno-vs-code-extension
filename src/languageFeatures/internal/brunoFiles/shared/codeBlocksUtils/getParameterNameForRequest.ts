import { Position as VsCodePosition } from "vscode";
import { LanguageFeatureRequestWithAdditionalData } from "../interfaces";
import { createSourceFile, ScriptTarget, SyntaxKind } from "typescript";
import { OutputChannelLogger } from "../../../../../shared";

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
    const firstContentLine = blockContentRange.start.line;

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
        document.offsetAt(new VsCodePosition(firstContentLine - 1, 0));

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
            .some(
                (child) =>
                    child.kind == SyntaxKind.PropertyAccessExpression &&
                    child.getText(sourceFile) ==
                        baseIdentifier.concat(".", functionName),
            );

        if (
            neededDepthReached &&
            childContainingPosition.kind == SyntaxKind.SyntaxList
        ) {
            const resultNode = childContainingPosition
                .getChildren(sourceFile)
                .find((child) => child.kind == SyntaxKind.StringLiteral);

            return resultNode?.getText(sourceFile);
        }

        currentNode = childContainingPosition;
    } while (currentNode.getText(sourceFile).includes(functionName));

    return undefined;
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for language feature.`);
}
