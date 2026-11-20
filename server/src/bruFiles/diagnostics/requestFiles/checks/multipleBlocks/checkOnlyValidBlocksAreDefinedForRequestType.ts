import {
    Block,
    getAllMethodBlocks,
    RequestFileBlockName,
} from "@global_shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

/**
 * For some request types (e.g. gRPC or websocket), only a limited set of blocks is valid.
 * Unknown block names and (invalid) method blocks are reported by other checks.
 */
export function checkOnlyValidBlocksAreDefinedForRequestType(
    blocks: Block[],
    actualRequestType: string | undefined,
    specificData: {
        requestType: string;
        validBlockNames: string[];
        diagnosticCode: NonBlockSpecificDiagnosticCode;
    },
): DiagnosticWithCode[] {
    const { requestType, validBlockNames, diagnosticCode } = specificData;

    if (actualRequestType != requestType) {
        return [];
    }

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
            message: `Block '${name}' is not valid for requests of type '${requestType}'. Allowed blocks: ${validBlockNames.map((valid) => `'${valid}'`).join(", ")}.`,
            range: nameRange,
            severity: DiagnosticSeverity.Error,
            code: diagnosticCode,
        }));
}
