import {
    Block,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    MetaBlockKey,
    RequestType,
    Position,
    Range,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { DiagnosticSeverity } from "vscode-languageserver";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkBlockForResponseValidationExists(
    documentHelper: TextDocumentHelper,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    if (
        // Websocket requests do not support any blocks for validating the response.
        getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
            blocks,
            RequestFileBlockName.Meta,
            MetaBlockKey.Type,
        )?.value == RequestType.Ws
    ) {
        return undefined;
    }

    if (
        blocks.filter(
            ({ name }) =>
                name == RequestFileBlockName.Tests ||
                name == RequestFileBlockName.Assertions ||
                name == RequestFileBlockName.PostResponseScript ||
                name == RequestFileBlockName.GrpcAfterMessageReceiveScript ||
                name == RequestFileBlockName.GrpcAfterCallEndScript,
        ).length == 0
    ) {
        return getDiagnostic(documentHelper);
    } else {
        return undefined;
    }
}

function getDiagnostic(documentHelper: TextDocumentHelper): DiagnosticWithCode {
    const lastLine = documentHelper.getLineByIndex(
        documentHelper.getLineCount() - 1,
    );

    return {
        message: `No '${RequestFileBlockName.Assertions}', '${RequestFileBlockName.PostResponseScript}' or '${RequestFileBlockName.Tests}' block (or a gRPC script block for after a message was received/the call ended) is defined.`,
        range: new Range(
            new Position(documentHelper.getLineCount() - 1, 0),
            new Position(documentHelper.getLineCount() - 1, lastLine.length),
        ),
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.NoBlockForResponseValidationDefined,
    };
}
