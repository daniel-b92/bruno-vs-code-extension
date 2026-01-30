import { DiagnosticSeverity, Uri } from "vscode";
import { isAuthBlock, Block } from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkAtMostOneAuthBlockExists(
    documentUri: Uri,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const sortedAuthBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isAuthBlock(name)),
    );

    if (sortedAuthBlocks.length > 1) {
        return getDiagnostic(documentUri, sortedAuthBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedAuthBlocks: Block[],
): DiagnosticWithCode {
    return {
        message: "Too many 'auth' blocks are defined.",
        range: mapToVsCodeRange(
            sortedAuthBlocks[sortedAuthBlocks.length - 1].nameRange,
        ),
        relatedInformation: sortedAuthBlocks
            .slice(0, sortedAuthBlocks.length - 1)
            .map(({ name, nameRange }) => ({
                message: `Other auth block with name '${name}'`,
                location: {
                    uri: documentUri,
                    range: mapToVsCodeRange(nameRange),
                },
            })),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.TooManyAuthBlocksDefined;
}
