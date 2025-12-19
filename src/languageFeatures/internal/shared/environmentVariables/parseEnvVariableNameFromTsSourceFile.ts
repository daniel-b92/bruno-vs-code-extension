import { createSourceFile, Node, ScriptTarget, SyntaxKind } from "typescript";
import { OutputChannelLogger } from "../../../../shared";
import { LanguageFeatureRequest } from "../interfaces";

// ToDo: Find better name
export function parseEnvVariableNameFromTsSourceFile(
    file: {
        relevantContent: string;
        defaultOffsetWithinDocument?: number;
    },
    request: LanguageFeatureRequest,
    logger?: OutputChannelLogger,
) {
    const {
        relevantContent,

        defaultOffsetWithinDocument,
    } = file;
    const { document, position, token } = request;
    const { baseIdentifier, functionName } = getIdentifiers();
    const defaultOffsetToUse =
        defaultOffsetWithinDocument != undefined
            ? defaultOffsetWithinDocument
            : 0;
    const offsetWithinSubdocument =
        document.offsetAt(position) - defaultOffsetToUse;

    if (
        !relevantContent.includes(baseIdentifier) ||
        !relevantContent.includes(functionName)
    ) {
        return undefined;
    }

    const sourceFile = createSourceFile(
        "__temp.js",
        relevantContent,
        ScriptTarget.ES2020,
    );

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const checkedNodes: Node[] = [sourceFile as Node];

    do {
        if (token.isCancellationRequested) {
            addLogEntryForCancellation(logger);
            return undefined;
        }

        const currentNode = checkedNodes[checkedNodes.length - 1];

        const childContainingPosition = currentNode
            .getChildren(sourceFile)
            .find(
                (child) =>
                    child.getStart(sourceFile) <= offsetWithinSubdocument &&
                    child.getEnd() >= offsetWithinSubdocument,
            );

        if (!childContainingPosition) {
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
                        SyntaxKind.NoSubstitutionTemplateLiteral, // String quoted via '`'
                        SyntaxKind.StringLiteral, // String quoted via '"' or "'"
                    ].includes(child.kind),
                );

            return resultNode
                ? {
                      text: resultNode.getText(sourceFile),
                      start: document.positionAt(
                          defaultOffsetToUse +
                              resultNode.getStart(sourceFile, true),
                      ),
                      end: document.positionAt(
                          defaultOffsetToUse + resultNode.getEnd(),
                      ),
                  }
                : undefined;
        }

        checkedNodes.push(childContainingPosition);
    } while (
        checkedNodes[checkedNodes.length - 1]
            .getText(sourceFile)
            .includes(functionName)
    );

    return undefined;
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for language feature.`);
}

function getIdentifiers() {
    return { baseIdentifier: "bru", functionName: "getEnvVar" };
}
