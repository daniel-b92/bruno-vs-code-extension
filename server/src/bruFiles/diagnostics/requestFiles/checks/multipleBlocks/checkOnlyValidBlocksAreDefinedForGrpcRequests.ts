import {
    Block,
    getValidBlockNamesForGrpcRequest,
    RequestType,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { checkOnlyValidBlocksAreDefinedForRequestType } from "./checkOnlyValidBlocksAreDefinedForRequestType";

export function checkOnlyValidBlocksAreDefinedForGrpcRequests(
    blocks: Block[],
    requestType: string | undefined,
): DiagnosticWithCode[] {
    return checkOnlyValidBlocksAreDefinedForRequestType(blocks, requestType, {
        requestType: RequestType.Grpc,
        validBlockNames: getValidBlockNamesForGrpcRequest(),
        diagnosticCode:
            NonBlockSpecificDiagnosticCode.BlockNotValidForGrpcRequestType,
    });
}
