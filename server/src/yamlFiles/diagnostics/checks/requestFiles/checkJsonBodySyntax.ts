import {
    HttpBodyType,
    ParsedRequestFile,
    Range,
    ParsedStringScalarWithStyle,
    TextDocumentHelper,
} from "@global_shared";
import { Diagnostic } from "vscode-languageserver";
import {
    checkJsonSyntax,
    PreciseErrorPositionMapping,
} from "../../../../shared";

export function checkJsonBodySyntax(
    body: NonNullable<
        ParsedRequestFile["properties"]["http"]
    >["properties"]["body"],
    docHelper: TextDocumentHelper,
): Diagnostic | undefined {
    const { type, data } = body?.properties ?? {};

    return type?.value == HttpBodyType.Json
        ? checkJsonScalarSyntax(data, docHelper)
        : undefined;
}

export function checkJsonScalarSyntax(
    data: ParsedStringScalarWithStyle | undefined,
    docHelper: TextDocumentHelper,
): Diagnostic | undefined {
    if (!data) {
        return undefined;
    }

    return checkJsonSyntax(
        { content: data.value, contentRange: data.valueRange },
        data.isLiteralBlockScalar
            ? getPositionMappingForLiteralBlockScalar(
                  data.value,
                  data.valueRange,
                  docHelper,
              )
            : undefined,
    )?.diagnostic;
}

/**
 * Only for literal block scalars (`|`, `|-`, `|+`), the lines in the document are the same as in the parsed value (just shifted by a constant indentation).
 * For all other scalar styles (quoted, folded, plain), line breaks and escaping make a precise mapping unreliable.
 */
function getPositionMappingForLiteralBlockScalar(
    value: string,
    valueRange: Range,
    docHelper: TextDocumentHelper,
): PreciseErrorPositionMapping | undefined {
    const firstContentLine = valueRange.start.line + 1;
    const lastLine = Math.min(
        valueRange.end.line,
        docHelper.getLineCount() - 1,
    );
    // Blank lines can be shorter than the indentation, so the first non-blank line determines it.
    const firstNonBlankValueLine = value
        .split("\n")
        .find((line) => line.trim() != "");

    if (firstNonBlankValueLine == undefined) {
        return undefined;
    }

    for (let i = firstContentLine; i <= lastLine; i++) {
        const line = docHelper.getLineByIndex(i);

        if (line.trim() != "") {
            // Whitespace that is part of the value (more indentation than the block's) is not part of the block indentation.
            return {
                firstContentLine,
                indentation:
                    leadingWhitespace(line) -
                    leadingWhitespace(firstNonBlankValueLine),
            };
        }
    }

    return undefined;
}

function leadingWhitespace(line: string) {
    return line.length - line.trimStart().length;
}
