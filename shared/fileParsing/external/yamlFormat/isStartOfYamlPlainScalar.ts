import { parseDocument, Scalar, visit } from "yaml";
import { Range, TextDocumentHelper } from "../../..";

/**
 * Checks whether the given range is the start of a plain (unquoted) Yaml scalar.
 * This is not the case e.g. within block scalars (`|`), quoted strings or at the continuation of a multiline scalar.
 *
 * The check is done by replacing the range with a placeholder word and looking for a plain scalar starting at it.
 * That way, it also works for incomplete text (e.g. an unclosed `{{`), which would not be parsed as a scalar otherwise.
 * The range needs to be within a single line.
 */
export function isStartOfYamlPlainScalar(
    docHelper: TextDocumentHelper,
    { start, end }: Range,
) {
    const patchedText = docHelper.getFullTextWithReplacement(
        {
            lineIndex: start.line,
            startCharIndex: start.character,
            endCharIndex: end.character,
        },
        PLACEHOLDER,
    );
    const offset = docHelper.getOffsetForPosition(start);
    let result = false;

    visit(parseDocument(patchedText), {
        Scalar(_, { type, range }) {
            if (range && range[0] == offset) {
                result = type == Scalar.PLAIN;
                return visit.BREAK;
            }
            return undefined;
        },
    });

    return result;
}

const PLACEHOLDER = "x";
