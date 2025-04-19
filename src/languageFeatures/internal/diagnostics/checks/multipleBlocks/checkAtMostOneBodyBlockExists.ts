import { Diagnostic, DiagnosticSeverity, Uri } from "vscode";
import { RequestFileBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getSortedBlocksOrFieldsByPosition } from "../../util/getSortedBlocksOrFieldsByPosition";
import { isBodyBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/isBodyBlock";

export function checkAtMostOneBodyBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): Diagnostic | DiagnosticCode {
    const sortedBodyBlocks = getSortedBlocksOrFieldsByPosition(
        blocks.filter(({ name }) => isBodyBlock(name))
    );

    if (sortedBodyBlocks.length > 1) {
        return getDiagnostic(documentUri, sortedBodyBlocks);
    } else {
        return DiagnosticCode.TooManyBodyBlocksDefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBodyBlocks: RequestFileBlock[]
): Diagnostic {
    return {
        message: "Too many 'body' blocks are defined.",
        range: sortedBodyBlocks[sortedBodyBlocks.length - 1].nameRange,
        relatedInformation: sortedBodyBlocks
            .slice(0, sortedBodyBlocks.length - 1)
            .map(({ name, nameRange }) => ({
                message: `Other body block with name '${name}'`,
                location: { uri: documentUri, range: nameRange },
            })),
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.TooManyBodyBlocksDefined,
    };
}
