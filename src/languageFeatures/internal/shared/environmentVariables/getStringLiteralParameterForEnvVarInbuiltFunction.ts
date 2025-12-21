import {
    createSourceFile,
    Node,
    ScriptTarget,
    SourceFile,
    SyntaxKind,
} from "typescript";
import { OutputChannelLogger } from "../../../../shared";
import {
    InbuiltFunctionIdentifier,
    LanguageFeatureRequest,
} from "../interfaces";

export function getStringLiteralParameterForInbuiltFunction(params: {
    relevantContent: string;
    functionsToSearchFor: InbuiltFunctionIdentifier[];
    defaultOffsetWithinDocument?: number;
    request: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}) {
    const {
        relevantContent,
        functionsToSearchFor,
        request,
        defaultOffsetWithinDocument,
        logger,
    } = params;
    const { token } = request;
    const { defaultOffsetToUse, offsetWithinSubdocument } = getOffsetsToUse(
        request,
        defaultOffsetWithinDocument,
    );
    const { asTsNode: contentAsTsNode, sourceFile } =
        parseAsTsNode(relevantContent);

    if (
        functionsToSearchFor.every(
            ({ baseIdentifier, functionName }) =>
                !relevantContent.includes(baseIdentifier) ||
                !relevantContent.includes(functionName),
        )
    ) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const checkedNodes: Node[] = [contentAsTsNode];
    let inbuiltFunctionForRequest: InbuiltFunctionIdentifier | undefined;

    do {
        if (token.isCancellationRequested) {
            addLogEntryForCancellation(logger);
            return undefined;
        }

        const currentNode = checkedNodes[checkedNodes.length - 1];

        const childContainingPosition = getChildNodeContainingPosition(
            currentNode,
            sourceFile,
            offsetWithinSubdocument,
        );

        if (!childContainingPosition) {
            return undefined;
        }

        const { node: childNodeContainingPosition } = childContainingPosition;

        const neededDepthReached = currentNode
            .getChildren(sourceFile)
            .some((child) => {
                const childText = child.getText(sourceFile);

                inbuiltFunctionForRequest = functionsToSearchFor.find(
                    ({ baseIdentifier, functionName }) =>
                        childText.startsWith(baseIdentifier) &&
                        childText.includes(".") &&
                        childText.endsWith(functionName),
                );

                return (
                    child.kind == SyntaxKind.PropertyAccessExpression &&
                    inbuiltFunctionForRequest != undefined
                );
            });

        if (
            neededDepthReached &&
            childNodeContainingPosition.kind == SyntaxKind.SyntaxList
        ) {
            const grandChildContainingPosition = getChildNodeContainingPosition(
                childNodeContainingPosition,
                sourceFile,
                offsetWithinSubdocument,
            );

            if (
                grandChildContainingPosition == undefined ||
                grandChildContainingPosition.childIndex != 0 // The first parameter is always the environment variable name for all inbuilt functions.
            ) {
                return undefined;
            }

            const { node: resultNode } = grandChildContainingPosition;

            const canHandleNodeType = [
                SyntaxKind.NoSubstitutionTemplateLiteral, // String quoted via '`'
                SyntaxKind.StringLiteral, // String quoted via '"' or "'"
            ].includes(resultNode.kind);

            return canHandleNodeType
                ? ({
                      inbuiltFunction: inbuiltFunctionForRequest,
                      variableName: extractVariableNameFromResultNode(
                          resultNode,
                          sourceFile,
                          params.request,
                          defaultOffsetToUse,
                      ),
                  } as {
                      inbuiltFunction: InbuiltFunctionIdentifier;
                      variableName: string;
                  })
                : undefined;
        }

        checkedNodes.push(childNodeContainingPosition);
    } while (
        functionsToSearchFor.some(({ functionName }) =>
            checkedNodes[checkedNodes.length - 1]
                .getText(sourceFile)
                .includes(functionName),
        )
    );

    return undefined;
}

function extractVariableNameFromResultNode(
    resultNode: Node,
    sourceFile: SourceFile,
    { document, position }: LanguageFeatureRequest,
    defaultOffsetToUse: number,
) {
    const fullParameter = {
        text: resultNode.getText(sourceFile),
        start: document.positionAt(
            defaultOffsetToUse + resultNode.getStart(sourceFile, true),
        ),
        end: document.positionAt(defaultOffsetToUse + resultNode.getEnd()),
    };

    if (!fullParameter) {
        return undefined;
    }

    const { text, start, end } = fullParameter;
    const startsWithQuotes = /^("|'|`)/.test(text);
    const endsWithQuotes = /("|'|`)$/.test(text);

    return startsWithQuotes &&
        endsWithQuotes &&
        position.compareTo(start) > 0 &&
        position.compareTo(end) < 0
        ? text.substring(1, text.length - 1)
        : undefined;
}

function getChildNodeContainingPosition(
    currentNode: Node,
    sourceFile: SourceFile,
    offset: number,
) {
    const index = currentNode
        .getChildren(sourceFile)
        .findIndex(
            (child) =>
                child.getStart(sourceFile) <= offset &&
                child.getEnd() >= offset,
        );

    return index > -1
        ? { childIndex: index, node: currentNode.getChildAt(index, sourceFile) }
        : undefined;
}

function getOffsetsToUse(
    { document, position }: LanguageFeatureRequest,
    defaultOffsetWithinDocument?: number,
) {
    const defaultOffsetToUse =
        defaultOffsetWithinDocument != undefined
            ? defaultOffsetWithinDocument
            : 0;

    const offsetWithinSubdocument =
        document.offsetAt(position) - defaultOffsetToUse;

    return { defaultOffsetToUse, offsetWithinSubdocument };
}

function parseAsTsNode(relevantContent: string) {
    const sourceFile = createSourceFile(
        "__temp.js",
        relevantContent,
        ScriptTarget.ES2020,
    );

    return {
        asTsNode: sourceFile as Node,
        sourceFile,
    };
}

function addLogEntryForCancellation(logger?: OutputChannelLogger) {
    logger?.debug(`Cancellation requested for language feature.`);
}
