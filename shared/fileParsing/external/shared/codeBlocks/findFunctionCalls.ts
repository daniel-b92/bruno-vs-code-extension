import { tokTypes } from "acorn";
import {
    isNameToken,
    JavascriptToken,
    tokenizeJavascript,
} from "../../../internal/shared/tokenizeJavascript";

export interface OffsetRange {
    start: number;
    end: number;
}

export interface FunctionIdentifier {
    /** E.g. `bru` */
    baseIdentifier: string;
    /** E.g. `getVar` */
    functionName: string;
}

export interface FunctionCall<T extends FunctionIdentifier> {
    identifier: T;
    /** The part of the call before the opening bracket (e.g. `bru.getVar`). */
    callee: OffsetRange;
    /** The call including the arguments. If the closing bracket is missing, only the first argument is included. */
    call: OffsetRange;
    /** Includes the quotes. Is `undefined` if the first argument is not a string literal without substitutions. */
    firstParameter: OffsetRange | undefined;
}

/**
 * Finds all calls like `bru.getVar(...)` (also with optional chaining) in the content.
 */
export function findFunctionCalls<T extends FunctionIdentifier>(
    content: string,
    functionsToSearchFor: T[],
): FunctionCall<T>[] {
    const tokens = tokenizeJavascript(content);
    const calls: FunctionCall<T>[] = [];

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

    // The `template` token (the text between the backticks) can be missing, depending on the content.
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
