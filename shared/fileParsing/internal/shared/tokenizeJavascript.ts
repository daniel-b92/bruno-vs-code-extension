import { tokenizer, tokTypes, TokenType } from "acorn";

export interface JavascriptToken {
    type: TokenType;
    /** Offset of the first character in the content. */
    start: number;
    /** Offset after the last character in the content. */
    end: number;
}

/**
 * Splits Javascript code into tokens (without building a syntax tree), so that it also works for code that is currently being edited.
 *
 * Only lexical errors (e.g. a string that is not closed within its line) make the tokenizer fail.
 * In that case, the rest of the line is skipped and tokenizing continues in the next line.
 * So an error only affects the code close to it.
 */
export function tokenizeJavascript(content: string): JavascriptToken[] {
    const tokens: JavascriptToken[] = [];
    let offset = 0;

    while (offset < content.length) {
        const remainingContent = content.substring(offset);

        try {
            for (const { type, start, end } of tokenizer(remainingContent, {
                ecmaVersion: "latest",
            })) {
                tokens.push({ type, start: start + offset, end: end + offset });
            }

            return tokens;
        } catch (error) {
            const errorPosition =
                error instanceof SyntaxError &&
                "pos" in error &&
                typeof error.pos == "number"
                    ? error.pos
                    : 0;
            const endOfErrorLine = remainingContent.indexOf(
                "\n",
                errorPosition,
            );

            if (endOfErrorLine < 0) {
                return tokens;
            }

            offset += endOfErrorLine + 1;
        }
    }

    return tokens;
}

export function isNameToken({ type }: JavascriptToken) {
    // Keywords can be used as property names (e.g. `req.delete`).
    return type == tokTypes.name || Boolean(type.keyword);
}
