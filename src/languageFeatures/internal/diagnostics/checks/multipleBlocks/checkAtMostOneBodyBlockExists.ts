import { DiagnosticSeverity, Uri } from "vscode";
import { RequestFileBlock, isBodyBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../definitions";

export function checkAtMostOneBodyBlockExists(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | DiagnosticCode {
    const sortedBodyBlocks = getSortedBlocksByPosition(
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
): DiagnosticWithCode {
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
