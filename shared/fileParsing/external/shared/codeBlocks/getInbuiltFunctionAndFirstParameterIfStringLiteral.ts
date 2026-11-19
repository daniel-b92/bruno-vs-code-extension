import {
    InbuiltFunctionIdentifier,
    Position,
    Range,
    TextDocumentHelper,
} from "../../../..";
import { findFunctionCalls, OffsetRange } from "./findFunctionCalls";

export interface InbuiltFunctionParsingParams {
    relevantContent: {
        asString: string;
        startPosition: Position;
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
        },
        functionsToSearchFor,
        position,
    } = params;

    if (
        functionsToSearchFor.every(
            ({ baseIdentifier, functionName }) =>
                !relevantContent.includes(baseIdentifier) ||
                !relevantContent.includes(functionName),
        )
    ) {
        return undefined;
    }

    const subDocumentHelper = new TextDocumentHelper(relevantContent);
    const offsetWithinSubdocument = getOffsetWithinSubdocument(
        position,
        subDocumentHelper,
        contentStartPosition,
    );

    // If calls are nested (e.g. `bru.setVar("a", bru.getVar("b"))`), the innermost call that contains the position is relevant.
    const innermostCall = findFunctionCalls(
        relevantContent,
        functionsToSearchFor,
    )
        .filter(({ call }) =>
            doesRangeContainOffset(call, offsetWithinSubdocument),
        )
        .sort((a, b) => b.call.start - a.call.start)[0];

    if (!innermostCall?.firstParameter) {
        return undefined;
    }

    const { identifier, callee, firstParameter } = innermostCall;
    const parameterPositions = getParameterPositions(
        firstParameter,
        subDocumentHelper,
        contentStartPosition,
    );

    return parameterPositions
        ? {
              inbuiltFunction: {
                  identifier,
                  nodeContainsPosition: doesRangeContainOffset(
                      callee,
                      offsetWithinSubdocument,
                  ),
              },
              firstParameter: {
                  name: relevantContent.substring(
                      firstParameter.start + 1,
                      firstParameter.end - 1,
                  ),
                  ...parameterPositions,
                  nodeContainsPosition: doesRangeContainOffset(
                      firstParameter,
                      offsetWithinSubdocument,
                  ),
              },
          }
        : undefined;
}

function doesRangeContainOffset({ start, end }: OffsetRange, offset: number) {
    return start < offset && end > offset;
}

function getOffsetWithinSubdocument(
    position: Position,
    subDocumentHelper: TextDocumentHelper,
    contentStartPosition: Position,
) {
    return subDocumentHelper.getText(
        new Range(
            new Position(0, 0),
            new Position(
                position.line - contentStartPosition.line,
                position.character,
            ),
        ),
    ).length;
}

/**
 * The positions of the content within the quotes.
 */
function getParameterPositions(
    { start, end }: OffsetRange,
    subDocumentHelper: TextDocumentHelper,
    contentStartPosition: Position,
) {
    const startInSubdocument = subDocumentHelper.getPositionForOffset(
        new Position(0, 0),
        start + 1,
    );
    const endInSubdocument = subDocumentHelper.getPositionForOffset(
        new Position(0, 0),
        end - 1,
    );

    if (!startInSubdocument || !endInSubdocument) {
        return undefined;
    }

    return {
        start: new Position(
            startInSubdocument.line + contentStartPosition.line,
            startInSubdocument.character,
        ),
        end: new Position(
            endInSubdocument.line + contentStartPosition.line,
            endInSubdocument.character,
        ),
    };
}
