import { Diagnostic, DiagnosticSeverity, Uri } from "vscode";
import { RequestFileBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { isAuthBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/isAuthBlock";
import { getSortedBlocksOrFieldsByPosition } from "../../util/getSortedBlocksOrFieldsByPosition";

export function checkAtMostOneAuthBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): Diagnostic | DiagnosticCode {
    const sortedAuthBlocks = getSortedBlocksOrFieldsByPosition(
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
): Diagnostic {
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
