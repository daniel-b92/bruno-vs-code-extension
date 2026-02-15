import { isAuthBlock, Block } from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkAtMostOneAuthBlockExists(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const sortedAuthBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isAuthBlock(name)),
    );

    if (sortedAuthBlocks.length > 1) {
        return getDiagnostic(filePath, sortedAuthBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    filePath: string,
    sortedAuthBlocks: Block[],
): DiagnosticWithCode {
    return {
        message: "Too many 'auth' blocks are defined.",
        range: sortedAuthBlocks[sortedAuthBlocks.length - 1].nameRange,
        relatedInformation: sortedAuthBlocks
            .slice(0, sortedAuthBlocks.length - 1)
            .map(({ name, nameRange }) => ({
                message: `Other auth block with name '${name}'`,
                location: {
                    uri: URI.file(filePath).toString(),
                    range: nameRange,
                },
            })),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.TooManyAuthBlocksDefined;
}
