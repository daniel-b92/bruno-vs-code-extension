import { DiagnosticSeverity, Uri } from "vscode";
import { isAuthBlock, RequestFileBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../definitions";

export function checkAtMostOneAuthBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | DiagnosticCode {
    const sortedAuthBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isAuthBlock(name))
    );

    if (sortedAuthBlocks.length > 1) {
        return getDiagnostic(documentUri, sortedAuthBlocks);
    } else {
        return DiagnosticCode.TooManyAuthBlocksDefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedAuthBlocks: RequestFileBlock[]
): DiagnosticWithCode {
    return {
        message: "Too many 'auth' blocks are defined.",
        range: sortedAuthBlocks[sortedAuthBlocks.length - 1].nameRange,
        relatedInformation: sortedAuthBlocks
            .slice(0, sortedAuthBlocks.length - 1)
            .map(({ name, nameRange }) => ({
                message: `Other auth block with name '${name}'`,
                location: { uri: documentUri, range: nameRange },
            })),
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.TooManyAuthBlocksDefined,
    };
}
