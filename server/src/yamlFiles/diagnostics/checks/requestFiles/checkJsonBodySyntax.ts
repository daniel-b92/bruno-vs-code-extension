import {
    HttpBodyType,
    ParsedRequestFile,
    Range,
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

    if (type?.value != HttpBodyType.Json || !data) {
        return undefined;
    }

    return checkJsonSyntax(
        { content: data.value, contentRange: data.valueRange },
        getPositionMappingForLiteralBlockScalar(data.valueRange, docHelper),
    )?.diagnostic;
}

/**
 * Only for literal block scalars (`|`, `|-`, `|+`), the lines in the document are the same as in the parsed value (just shifted by a constant indentation).
 * For all other scalar styles (quoted, folded, plain), line breaks and escaping make a precise mapping unreliable.
 */
function getPositionMappingForLiteralBlockScalar(
    valueRange: Range,
    docHelper: TextDocumentHelper,
): PreciseErrorPositionMapping | undefined {
    const headerLine = docHelper.getLineByIndex(valueRange.start.line);
    const isLiteralBlockScalar = /^\|[+-]?\d*\s*(#.*)?$/.test(
        headerLine.slice(valueRange.start.character).trim(),
    );

    if (!isLiteralBlockScalar) {
        return undefined;
    }

    const firstContentLine = valueRange.start.line + 1;
    const lastLine = Math.min(
        valueRange.end.line,
        docHelper.getLineCount() - 1,
    );

    for (let i = firstContentLine; i <= lastLine; i++) {
        const line = docHelper.getLineByIndex(i);

        if (line.trim() != "") {
            // Blank lines can be shorter than the indentation, so the first non-blank line determines it.
            return {
                firstContentLine,
                indentation: line.length - line.trimStart().length,
            };
        }
    }

    return undefined;
}
