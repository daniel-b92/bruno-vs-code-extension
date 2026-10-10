import {
    Block,
    DictionaryBlockSimpleField,
    getGrpcSpecificBlocks,
    RequestType,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests } from "./checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests";

export function checkGrpcSpecificBlocksAreNotDefinedForOtherRequests(
    filePath: string,
    blocks: Block[],
    requestTypeField: DictionaryBlockSimpleField | undefined,
): DiagnosticWithCode | undefined {
    return checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests(
        filePath,
        blocks,
        requestTypeField,
        {
            requestType: RequestType.Grpc,
            specificBlockNames: getGrpcSpecificBlocks(),
            requestTypeLabel: "gRPC",
            diagnosticCode:
                NonBlockSpecificDiagnosticCode.GrpcBlocksDefinedForNonGrpcRequestType,
        },
    );
}
