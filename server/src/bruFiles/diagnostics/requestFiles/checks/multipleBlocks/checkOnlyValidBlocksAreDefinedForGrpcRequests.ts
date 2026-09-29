import {
    Block,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    getAllMethodBlocks,
    getValidBlockNamesForGrpcRequest,
    MetaBlockKey,
    RequestFileBlockName,
    RequestType,
} from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

/**
 * For gRPC requests, only a limited set of blocks is valid.
 * Unknown block names and (invalid) method blocks are reported by other checks.
 */
export function checkOnlyValidBlocksAreDefinedForGrpcRequests(
    blocks: Block[],
): DiagnosticWithCode[] {
    const requestType = getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
        blocks,
        RequestFileBlockName.Meta,
        MetaBlockKey.Type,
    )?.value;

    if (requestType != RequestType.Grpc) {
        return [];
    }

    const validBlockNames = getValidBlockNamesForGrpcRequest();
    const allKnownBlockNames = Object.values(RequestFileBlockName) as string[];
    const methodBlocks = getAllMethodBlocks(blocks);

    return blocks
        .filter(
            (block) =>
                allKnownBlockNames.includes(block.name) &&
                !validBlockNames.includes(block.name) &&
                !methodBlocks.includes(block),
        )
        .map(({ name, nameRange }) => ({
            message: `Block '${name}' is not valid for requests of type '${RequestType.Grpc}'. Allowed blocks: ${validBlockNames.map((valid) => `'${valid}'`).join(", ")}.`,
            range: nameRange,
            severity: DiagnosticSeverity.Error,
            code: NonBlockSpecificDiagnosticCode.BlockNotValidForGrpcRequestType,
        }));
}
