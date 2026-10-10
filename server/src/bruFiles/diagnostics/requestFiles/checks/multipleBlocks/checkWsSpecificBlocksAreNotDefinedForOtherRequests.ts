import { Block, getWsSpecificBlocks, RequestType } from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests } from "./checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests";

export function checkWsSpecificBlocksAreNotDefinedForOtherRequests(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    return checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests(
        filePath,
        blocks,
        {
            requestType: RequestType.Ws,
            specificBlockNames: getWsSpecificBlocks(),
            requestTypeLabel: "websocket",
            diagnosticCode:
                NonBlockSpecificDiagnosticCode.WsBlocksDefinedForNonWsRequestType,
        },
    );
}
