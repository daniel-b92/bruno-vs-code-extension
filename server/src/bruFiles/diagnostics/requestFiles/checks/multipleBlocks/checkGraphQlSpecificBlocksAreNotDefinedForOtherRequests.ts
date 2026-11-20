import {
    Block,
    DictionaryBlockSimpleField,
    getGraphQlSpecificBlocks,
    RequestType,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests } from "./checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests";

export function checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests(
    filePath: string,
    blocks: Block[],
    requestTypeField: DictionaryBlockSimpleField | undefined,
): DiagnosticWithCode | undefined {
    return checkRequestTypeSpecificBlocksAreNotDefinedForOtherRequests(
        filePath,
        blocks,
        requestTypeField,
        {
            requestType: RequestType.Graphql,
            specificBlockNames: getGraphQlSpecificBlocks(),
            requestTypeLabel: "GraphQL",
            diagnosticCode:
                NonBlockSpecificDiagnosticCode.GraphQlBlocksDefinedForNonGraphQlRequestType,
        },
    );
}
