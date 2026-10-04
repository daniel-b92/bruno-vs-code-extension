import {
    ParsedRequestFile,
    ParsedWebsocketMessageContent,
    TextDocumentHelper,
    WebsocketMessageType,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { checkJsonScalarSyntax } from "./checkJsonBodySyntax";

export function checkWebsocketMessages(
    websocket: ParsedRequestFile["properties"]["websocket"],
    docHelper: TextDocumentHelper,
): (Diagnostic | undefined)[] {
    return (websocket?.properties.message ?? []).map(({ properties }) =>
        checkMessageContent(properties.message, docHelper),
    );
}

function checkMessageContent(
    content: ParsedWebsocketMessageContent | undefined,
    docHelper: TextDocumentHelper,
): Diagnostic | undefined {
    const { type, data } = content?.properties ?? {};

    if (!type) {
        return undefined;
    }

    if (!data) {
        return {
            message: `No message data is defined for the message type '${type.value}'.`,
            range: type.valueRange,
            severity: DiagnosticSeverity.Warning,
        };
    }

    // Empty data is not reported as invalid JSON (consistent with the check for graphql variables).
    return type.value == WebsocketMessageType.Json && data.value.trim() != ""
        ? checkJsonScalarSyntax(data, docHelper)
        : undefined;
}
