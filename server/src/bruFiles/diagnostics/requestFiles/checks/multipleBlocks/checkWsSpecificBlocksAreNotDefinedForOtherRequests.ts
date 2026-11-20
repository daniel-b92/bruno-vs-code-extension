import {
    Block,
    DictionaryBlockSimpleField,
    getWsSpecificBlocks,
    RequestType,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests } from "./checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests";

export function checkWsSpecificBlocksAreNotDefinedForOtherRequests(
    filePath: string,
    blocks: Block[],
    requestTypeField: DictionaryBlockSimpleField | undefined,
): DiagnosticWithCode | undefined {
    return checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests(
        filePath,
        blocks,
        requestTypeField,
        {
            requestType: RequestType.Ws,
            specificBlockNames: getWsSpecificBlocks(),
            requestTypeLabel: "websocket",
            diagnosticCode:
                NonBlockSpecificDiagnosticCode.WsBlocksDefinedForNonWsRequestType,
        },
    );
}
