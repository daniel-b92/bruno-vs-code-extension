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

export function getStringLiteralParameterForEnvVarInbuiltFunction(params: {
    relevantContent: string;
    inbuiltFunction: InbuiltFunctionIdentifier;
    defaultOffsetWithinDocument?: number;
    request: LanguageFeatureRequest;
    logger?: OutputChannelLogger;
}) {
    const {
        relevantContent,
        inbuiltFunction: { baseIdentifier, functionName },
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
        !relevantContent.includes(baseIdentifier) ||
        !relevantContent.includes(functionName)
    ) {
        return undefined;
    }

    if (token.isCancellationRequested) {
        addLogEntryForCancellation(logger);
        return undefined;
    }

    const checkedNodes: Node[] = [contentAsTsNode];

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
            // ToDo: Always only check the first parameter from the list of parameters since this is the name of the environment variable for all inbuilt functions.
            const resultNode = childContainingPosition
                .getChildren(sourceFile)
                .find((child) =>
                    [
                        SyntaxKind.NoSubstitutionTemplateLiteral, // String quoted via '`'
                        SyntaxKind.StringLiteral, // String quoted via '"' or "'"
                    ].includes(child.kind),
                );

            return resultNode
                ? extractVariableNameFromResultNode(
                      resultNode,
                      sourceFile,
                      params.request,
                      defaultOffsetToUse,
                  )
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
