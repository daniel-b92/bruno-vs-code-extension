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

export interface InbuiltFunctionParsingParams {
    relevantContent: {
        asString: string;
        startPosition: Position;
        offsetInFullDocument?: number;
    };
    functionsToSearchFor: InbuiltFunctionIdentifier[];
    position: Position;
}

export function getInbuiltFunctionAndFirstParameterIfStringLiteral(
    params: InbuiltFunctionParsingParams,
):
    | {
          inbuiltFunction: {
              identifier: InbuiltFunctionIdentifier;
              nodeContainsPosition: boolean;
          };
          firstParameter: {
              name: string;
              start: Position;
              end: Position;
              nodeContainsPosition: boolean;
          };
      }
    | undefined {
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
    const { offsetWithinSubdocument } = getOffsetsToUse(
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
        | {
              identifier: InbuiltFunctionIdentifier;
              node: Node;
              childNodeIndex: number;
          }
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
            const {
                childNodeIndex,
                child: node,
                functionIdentifier: identifier,
            } = childNodeForFunctionIdentifier;

            inbuiltFunctionForRequest = {
                identifier,
                node,
                childNodeIndex,
            };
            neededDepthReached = true;
        }

        if (!neededDepthReached) {
            const childContainingPosition = getChildNodeContainingOffset(
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
    const nodeForSyntaxList = lastReachedNode
        .getChildren(sourceFile)
        .find(({ kind }) => kind == SyntaxKind.SyntaxList);

    if (
        !neededDepthReached ||
        !inbuiltFunctionForRequest ||
        !nodeForSyntaxList
    ) {
        return undefined;
    }

    if (nodeForSyntaxList.getChildCount(sourceFile) == 0) {
        return undefined;
    }

    const firstParameterNode = nodeForSyntaxList.getChildAt(0, sourceFile);

    const canHandleNodeType = [
        SyntaxKind.NoSubstitutionTemplateLiteral, // String quoted via '`'
        SyntaxKind.StringLiteral, // String quoted via '"' or "'"
    ].includes(firstParameterNode.kind);

    const firstParameter = extractVariableNameFromResultNode(
        {
            startPosition: contentStartPosition,
            subDocumentHelper,
        },
        firstParameterNode,
        sourceFile,
    );

    return canHandleNodeType && firstParameter != undefined
        ? {
              inbuiltFunction: {
                  identifier: inbuiltFunctionForRequest.identifier,
                  nodeContainsPosition: doesNodeContainOffset(
                      inbuiltFunctionForRequest.node,
                      sourceFile,
                      offsetWithinSubdocument,
                  ),
              },
              firstParameter: {
                  ...firstParameter,
                  nodeContainsPosition: doesNodeContainOffset(
                      firstParameterNode,
                      sourceFile,
                      offsetWithinSubdocument,
                  ),
              },
          }
        : undefined;
}

function extractVariableNameFromResultNode(
    relevantContent: {
        subDocumentHelper: TextDocumentHelper;
        startPosition: Position;
    },
    resultNode: Node,
    sourceFile: SourceFile,
) {
    const { subDocumentHelper, startPosition: contentStartPosition } =
        relevantContent;

    const startInSubdocument = subDocumentHelper.getPositionForOffset(
        new Position(0, 0),
        resultNode.getStart(sourceFile, true),
    );
    const endInSubdocument = subDocumentHelper.getPositionForOffset(
        new Position(0, 0),
        resultNode.getEnd(),
    );

    if (!startInSubdocument || !endInSubdocument) {
        return undefined;
    }

    const fullParameter = {
        text: resultNode.getText(sourceFile),
        start: new Position(
            startInSubdocument.line + contentStartPosition.line,
            startInSubdocument.character,
        ),
        end: new Position(
            endInSubdocument.line + contentStartPosition.line,
            endInSubdocument.character,
        ),
    };

    const { text, start, end } = fullParameter;
    const startsWithQuotes = /^("|'|`)/.test(text);
    const endsWithQuotes = /("|'|`)$/.test(text);

    return startsWithQuotes && endsWithQuotes
        ? { name: text.substring(1, text.length - 1), start, end }
        : undefined;
}

function getChildNodeContainingOffset(
    currentNode: Node,
    sourceFile: SourceFile,
    offset: number,
) {
    const index = currentNode
        .getChildren(sourceFile)
        .findIndex((child) => doesNodeContainOffset(child, sourceFile, offset));

    return index >= 0
        ? { childIndex: index, node: currentNode.getChildAt(index, sourceFile) }
        : undefined;
}

function doesNodeContainOffset(
    node: Node,
    sourceFile: SourceFile,
    offset: number,
) {
    return node.getStart(sourceFile, true) < offset && node.getEnd() > offset;
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
        new Range(
            new Position(0, 0),
            new Position(
                position.line - contentStartPosition.line,
                position.character,
            ),
        ),
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
