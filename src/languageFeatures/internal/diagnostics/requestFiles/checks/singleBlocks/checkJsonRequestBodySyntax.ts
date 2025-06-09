import { DiagnosticSeverity } from "vscode";
import {
    Block,
    mapRange,
    RequestFileBlockName,
    Range,
    Position,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinBodyBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinBodyBlockDiagnosticCodeEnum";

export function checkJsonRequestBodySyntax(
    requestBody: Block
): DiagnosticWithCode | undefined {
    if (
        requestBody.name == RequestFileBlockName.JsonBody &&
        typeof requestBody.content == "string"
    ) {
        try {
            JSON.parse(requestBody.content);
        } catch (err) {
            return getDiagnostic(requestBody.contentRange, err);
        }
    } else {
        return undefined;
    }
}

function getDiagnostic(contentRange: Range, error: unknown) {
    if (!(error instanceof SyntaxError)) {
        return getDiagnosticForUnexpectedErrorWhileParsingJson(
            contentRange,
            error
        );
    }

    const startPosition = getPositionForSyntaxError(contentRange, error);

    if (startPosition) {
        const searchString = "in JSON";

        return {
            message: error.message.includes(searchString)
                ? error.message.substring(
                      0,
                      error.message.lastIndexOf(searchString)
                  )
                : error.message,
            range: mapRange(new Range(startPosition, startPosition)),
            severity: DiagnosticSeverity.Error,
            code: RelevantWithinBodyBlockDiagnosticCode.JsonSyntaxNotValid,
        };
    } else {
        return getDiagnosticForSyntaxErrorWithoutPosition(contentRange, error);
    }
}

function getPositionForSyntaxError(
    blockContentRange: Range,
    error: SyntaxError
) {
    const message = error.message;

    const matches = /\(line\s*(\d*)\s*column\s*(\d*)\s*\)$/m.exec(message);

    if (matches && matches.length >= 3) {
        const lineNumber =
            matches[1] && !isNaN(Number(matches[1]))
                ? Number(matches[1])
                : undefined;
        const columnNumber =
            matches[2] && !isNaN(Number(matches[2]))
                ? Number(matches[2])
                : undefined;

        // The displayed line number has base 1 instead of 0.
        return lineNumber && lineNumber >= 1 && columnNumber
            ? new Position(
                  lineNumber - 1 + blockContentRange.start.line,
                  lineNumber > 1
                      ? columnNumber
                      : columnNumber - blockContentRange.start.character
              )
            : undefined;
    } else {
        return undefined;
    }
}

function getDiagnosticForUnexpectedErrorWhileParsingJson(
    blockContentRange: Range,
    error: unknown
) {
    return {
        message: `An unexpected error ocured while trying to parse the JSON request body. ${
            error instanceof Error
                ? `Got error message '${error.message}'.`
                : "Failed to parse message from error."
        }`,
        range: mapRange(blockContentRange),
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinBodyBlockDiagnosticCode.UnexpectedErrorWhileParsingJson,
    };
}

function getDiagnosticForSyntaxErrorWithoutPosition(
    blockContentRange: Range,
    error: SyntaxError
) {
    return {
        message: error.message,
        range: mapRange(blockContentRange),
        severity: DiagnosticSeverity.Error,
        code: RelevantWithinBodyBlockDiagnosticCode.JsonSyntaxNotValid,
    };
}
