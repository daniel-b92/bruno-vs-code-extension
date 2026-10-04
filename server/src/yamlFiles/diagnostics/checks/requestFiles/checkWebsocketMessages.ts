import {
    ParsedRequestFile,
    ParsedWebsocketMessageContent,
    TextDocumentHelper,
    WebsocketMessageType,
} from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { checkJsonScalarSyntax } from "./checkJsonBodySyntax";

export function checkWebsocketMessages(
    {
        message,
        singleMessage,
    }: NonNullable<ParsedRequestFile["properties"]["websocket"]>["properties"],
    docHelper: TextDocumentHelper,
): (Diagnostic | undefined)[] {
    return [
        ...(message ?? []).map(({ properties }) =>
            checkMessageContent(properties.message, docHelper),
        ),
        checkMessageContent(singleMessage, docHelper),
    ];
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

    return type.value == WebsocketMessageType.Json
        ? checkJsonScalarSyntax(data, docHelper)
        : undefined;
}
