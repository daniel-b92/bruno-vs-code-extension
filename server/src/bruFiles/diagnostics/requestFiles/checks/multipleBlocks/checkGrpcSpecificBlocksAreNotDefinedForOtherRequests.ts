import { Block, getGrpcSpecificBlocks, RequestType } from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests } from "./checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests";

export function checkGrpcSpecificBlocksAreNotDefinedForOtherRequests(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    return checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests(
        filePath,
        blocks,
        {
            requestType: RequestType.Grpc,
            specificBlockNames: getGrpcSpecificBlocks(),
            requestTypeLabel: "gRPC",
            diagnosticCode:
                NonBlockSpecificDiagnosticCode.GrpcBlocksDefinedForNonGrpcRequestType,
        },
    );
}
