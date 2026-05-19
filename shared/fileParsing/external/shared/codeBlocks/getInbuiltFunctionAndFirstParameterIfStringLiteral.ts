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

    const descendantNodeWithFunctionIdentifier =
        searchDescendantNodesForFunctionIdentifier(
            sourceFile,
            contentAsTsNode,
            functionsToSearchFor,
            offsetWithinSubdocument,
        );

    if (!descendantNodeWithFunctionIdentifier) {
        return undefined;
    }

    const {
        parent: lastReachedNode,
        child: inbuiltFunctionNode,
        functionIdentifier,
    } = descendantNodeWithFunctionIdentifier;

    const nodeForSyntaxList = lastReachedNode
        .getChildren(sourceFile)
        .find(({ kind }) => kind == SyntaxKind.SyntaxList);

    if (!nodeForSyntaxList) {
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

    const firstParameter = extractVariableFromResultNode(
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
                  identifier: functionIdentifier,
                  nodeContainsPosition: doesNodeContainOffset(
                      inbuiltFunctionNode,
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

function searchDescendantNodesForFunctionIdentifier(
    sourceFile: SourceFile,
    startNode: Node,
    functionsToSearchFor: InbuiltFunctionIdentifier[],
    offset: number,
) {
    let currentNode: Node | undefined = startNode;
    let lastMatch:
        | {
              child: Node;
              childNodeIndex: number;
              functionIdentifier: InbuiltFunctionIdentifier;
          }
        | undefined = undefined;

    const traversedNodes: Node[] = [startNode];

    do {
        if (!currentNode) {
            return lastMatch != undefined
                ? {
                      parent: traversedNodes[traversedNodes.length - 1],
                      ...lastMatch,
                  }
                : undefined;
        }

        const currentMatch = findChildNodeForFunctionIdentifier(
            sourceFile,
            currentNode,
            functionsToSearchFor,
        );

        if (currentMatch) {
            lastMatch = currentMatch;
        }

        const childContainingPosition = getChildNodeContainingOffset(
            currentNode,
            sourceFile,
            offset,
        );

        if (!childContainingPosition) {
            return lastMatch != undefined
                ? {
                      parent: traversedNodes[traversedNodes.length - 1],
                      ...lastMatch,
                  }
                : undefined;
        }

        const continueCheckingChild = functionsToSearchFor.some(
            ({ baseIdentifier, functionName }) =>
                [baseIdentifier, functionName].every((text) =>
                    childContainingPosition.node
                        .getText(sourceFile)
                        .includes(text),
                ),
        );
        traversedNodes.push(currentNode);
        currentNode = continueCheckingChild
            ? childContainingPosition.node
            : undefined;
    } while (currentNode != undefined);
}

function findChildNodeForFunctionIdentifier(
    sourceFile: SourceFile,
    currentNode: Node,
    functionsToSearchFor: InbuiltFunctionIdentifier[],
) {
    return currentNode
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
}

function extractVariableFromResultNode(
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
        resultNode.getStart(sourceFile, true) + 1,
    );
    const endInSubdocument = subDocumentHelper.getPositionForOffset(
        new Position(0, 0),
        resultNode.getEnd() - 1,
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
