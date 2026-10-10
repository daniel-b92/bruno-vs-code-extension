import {
    Block,
    getValidBlockNamesForWsRequest,
    RequestType,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { checkOnlyValidBlocksAreDefinedForRequestType } from "./checkOnlyValidBlocksAreDefinedForRequestType";

export function checkOnlyValidBlocksAreDefinedForWsRequests(
    blocks: Block[],
): DiagnosticWithCode[] {
    return checkOnlyValidBlocksAreDefinedForRequestType(blocks, {
        requestType: RequestType.Ws,
        validBlockNames: getValidBlockNamesForWsRequest(),
        diagnosticCode:
            NonBlockSpecificDiagnosticCode.BlockNotValidForWsRequestType,
    });
}
