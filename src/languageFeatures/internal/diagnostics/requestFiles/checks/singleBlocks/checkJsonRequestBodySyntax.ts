import { DiagnosticSeverity } from "vscode";
import {
    Block,
    mapRange,
    RequestFileBlockName,
    Range,
    TextDocumentHelper,
    mapPosition,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinBodyBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinBodyBlockDiagnosticCodeEnum";

export function checkJsonRequestBodySyntax(
    document: TextDocumentHelper,
    requestBody: Block
): DiagnosticWithCode | undefined {
    if (
        requestBody.name == RequestFileBlockName.JsonBody &&
        typeof requestBody.content == "string"
    ) {
        try {
            JSON.parse(requestBody.content);
        } catch (err) {
            return getDiagnostic(document, requestBody.contentRange, err);
        }
    } else {
        return undefined;
    }
}

function getDiagnostic(
    document: TextDocumentHelper,
    contentRange: Range,
    error: unknown
) {
    if (!(error instanceof SyntaxError)) {
        return getDiagnosticForUnexpectedErrorWhileParsingJson(
            contentRange,
            error
        );
    }

    const startPosition = getPositionForSyntaxError(
        document,
        contentRange,
        error
    );

    if (startPosition) {
        const searchString = "at position ";

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
    document: TextDocumentHelper,
    blockContentRange: Range,
    error: SyntaxError
) {
    const message = error.message;

    const matches = /at position (\d*)\s*/.exec(message);

    if (matches && matches.length >= 2) {
        const offset =
            matches[1] && !isNaN(Number(matches[1]))
                ? Number(matches[1])
                : undefined;

        if (offset == undefined) {
            return undefined;
        }

        const positionInDocument = document.getPositionForOffset(
            blockContentRange.start,
            offset
        );

        return positionInDocument &&
            mapRange(blockContentRange).contains(
                mapPosition(positionInDocument)
            )
            ? positionInDocument
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
