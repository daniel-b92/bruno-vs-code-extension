import {
    createSourceFile,
    Node,
    ScriptTarget,
    SourceFile,
    SyntaxKind,
} from "typescript";
import {
    InbuiltFunctionIdentifier,
    Position,
    Range,
    TextDocumentHelper,
} from "../../../..";

export function getInbuiltFunctionAndFirstParameterIfStringLiteral(params: {
    relevantContent: {
        asString: string;
        startPosition: Position;
        offsetInFullDocument?: number;
    };
    functionsToSearchFor: InbuiltFunctionIdentifier[];
    position: Position;
}) {
    const {
        relevantContent: {
            asString: relevantContent,
            startPosition: contentStartPosition,
            offsetInFullDocument: defaultOffsetWithinDocument,
        },
        functionsToSearchFor,
        position,
    } = params;
    const subDocumentHelper = new TextDocumentHelper(relevantContent);
    const { defaultOffsetToUse, offsetWithinSubdocument } = getOffsetsToUse(
        position,
        subDocumentHelper,
        contentStartPosition,
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

    const traversedNodes: Node[] = [contentAsTsNode];
    let inbuiltFunctionForRequest:
        | { identifier: InbuiltFunctionIdentifier; childNodeIndex: number }
        | undefined;
    let neededDepthReached = false;

    do {
        const currentNode = traversedNodes[traversedNodes.length - 1];

        const childNodeForFunctionIdentifier = currentNode
            .getChildren(sourceFile)
            .flatMap((child, childNodeIndex) =>
                functionsToSearchFor.map((functionIdentifier) => ({
                    child,
                    childNodeIndex,
                    functionIdentifier,
                })),
            )
            .find(({ child, functionIdentifier }) => {
                const { baseIdentifier, functionName } = functionIdentifier;
                const childText = child.getText(sourceFile);

                const matchesFunctionIdentifier =
                    childText.startsWith(baseIdentifier) &&
                    childText.includes(".") &&
                    childText.endsWith(functionName);

                return (
                    matchesFunctionIdentifier &&
                    child.kind == SyntaxKind.PropertyAccessExpression
                );
            });

        if (childNodeForFunctionIdentifier != undefined) {
            const { childNodeIndex, functionIdentifier: identifier } =
                childNodeForFunctionIdentifier;

            inbuiltFunctionForRequest = {
                identifier,
                childNodeIndex,
            };
            neededDepthReached = true;
        }

        if (!neededDepthReached) {
            const childContainingPosition = getChildNodeContainingPosition(
                currentNode,
                sourceFile,
                offsetWithinSubdocument,
            );

            if (!childContainingPosition) {
                return undefined;
            }

            traversedNodes.push(childContainingPosition.node);
        }
    } while (
        !neededDepthReached &&
        functionsToSearchFor.some(({ functionName }) =>
            traversedNodes[traversedNodes.length - 1]
                .getText(sourceFile)
                .includes(functionName),
        )
    );

    const lastReachedNode = traversedNodes[traversedNodes.length - 1];

    if (!neededDepthReached || lastReachedNode.kind != SyntaxKind.SyntaxList) {
        return undefined;
    }

    const childContainingPosition = getChildNodeContainingPosition(
        lastReachedNode,
        sourceFile,
        offsetWithinSubdocument,
    );

    const grandChildContainingPosition = getChildNodeContainingPosition(
        lastReachedNode,
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

    return index >= 0
        ? { childIndex: index, node: currentNode.getChildAt(index, sourceFile) }
        : undefined;
}

function getOffsetsToUse(
    position: Position,
    subDocumentHelper: TextDocumentHelper,
    contentStartPosition: Position,
    defaultOffsetWithinDocument?: number,
) {
    const defaultOffsetToUse =
        defaultOffsetWithinDocument != undefined
            ? defaultOffsetWithinDocument
            : 0;

    const offsetWithinSubdocument = subDocumentHelper.getText(
        new Range(contentStartPosition, position),
    ).length;

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
