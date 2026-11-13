import { tokTypes } from "acorn";
import {
    InbuiltFunctionIdentifier,
    Position,
    Range,
    TextDocumentHelper,
} from "../../../..";
import {
    isNameToken,
    JavascriptToken,
    tokenizeJavascript,
} from "../../../internal/shared/tokenizeJavascript";

export interface InbuiltFunctionParsingParams {
    relevantContent: {
        asString: string;
        startPosition: Position;
        offsetInFullDocument?: number;
    };
    functionsToSearchFor: InbuiltFunctionIdentifier[];
    position: Position;
}

interface OffsetRange {
    start: number;
    end: number;
}

interface InbuiltFunctionCall {
    identifier: InbuiltFunctionIdentifier;
    /** The part of the call before the opening bracket (e.g. `bru.getVar`). */
    callee: OffsetRange;
    /** The call including the arguments. If the closing bracket is missing, only the first argument is included. */
    call: OffsetRange;
    /** Includes the quotes. Is `undefined` if the first argument is not a string literal without substitutions. */
    firstParameter: OffsetRange | undefined;
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
    const innermostCall = findInbuiltFunctionCalls(
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

/**
 * Finds all calls like `bru.getVar(...)` (also with optional chaining) in the content.
 */
function findInbuiltFunctionCalls(
    content: string,
    functionsToSearchFor: InbuiltFunctionIdentifier[],
): InbuiltFunctionCall[] {
    const tokens = tokenizeJavascript(content);
    const calls: InbuiltFunctionCall[] = [];

    tokens.forEach((baseToken, index) => {
        const [dotToken, functionNameToken, openingBracketToken] = tokens.slice(
            index + 1,
            index + 4,
        );
        const previousToken = tokens[index - 1];

        if (
            !isNameToken(baseToken) ||
            // Property of another object (e.g. `foo.bru.getVar()`)
            (previousToken && isPropertyAccessToken(previousToken)) ||
            !dotToken ||
            !isPropertyAccessToken(dotToken) ||
            !functionNameToken ||
            !isNameToken(functionNameToken) ||
            openingBracketToken?.type != tokTypes.parenL
        ) {
            return;
        }

        const baseIdentifier = getText(content, baseToken);
        const functionName = getText(content, functionNameToken);
        const identifier = functionsToSearchFor.find(
            (candidate) =>
                candidate.baseIdentifier == baseIdentifier &&
                candidate.functionName == functionName,
        );

        if (!identifier) {
            return;
        }

        const firstParameter = findStringLiteralStartingAt(tokens, index + 4);
        const closingBracketToken = findClosingBracket(tokens, index + 3);

        calls.push({
            identifier,
            callee: { start: baseToken.start, end: functionNameToken.end },
            call: {
                start: baseToken.start,
                end:
                    closingBracketToken?.end ??
                    firstParameter?.end ??
                    functionNameToken.end,
            },
            firstParameter,
        });
    });

    return calls;
}

function isPropertyAccessToken({ type }: JavascriptToken) {
    return type == tokTypes.dot || type == tokTypes.questionDot;
}

function getText(content: string, { start, end }: OffsetRange) {
    return content.substring(start, end);
}

/**
 * Handles strings quoted via `"` or `'` as well as template literals without substitutions.
 */
function findStringLiteralStartingAt(
    tokens: JavascriptToken[],
    index: number,
): OffsetRange | undefined {
    const [first, second, third] = tokens.slice(index, index + 3);

    if (first?.type == tokTypes.string) {
        return { start: first.start, end: first.end };
    }

    if (first?.type != tokTypes.backQuote) {
        return undefined;
    }

    // An empty template literal has no `template` token.
    const closingQuote = second?.type == tokTypes.template ? third : second;

    return closingQuote?.type == tokTypes.backQuote
        ? { start: first.start, end: closingQuote.end }
        : undefined;
}

function findClosingBracket(
    tokens: JavascriptToken[],
    openingBracketIndex: number,
) {
    let depth = 0;

    for (let i = openingBracketIndex; i < tokens.length; i++) {
        const token = tokens[i];

        if (token.type == tokTypes.parenL) {
            depth++;
        } else if (token.type == tokTypes.parenR && --depth == 0) {
            return token;
        }
    }

    return undefined;
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
