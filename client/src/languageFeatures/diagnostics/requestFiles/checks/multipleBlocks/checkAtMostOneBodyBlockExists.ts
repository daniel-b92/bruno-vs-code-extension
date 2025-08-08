import { DiagnosticSeverity, Uri } from "vscode";
import { Block, isBodyBlock, mapRange } from "../../../../../../../shared";
import { getSortedBlocksByPosition } from "../../../../../../../shared/languageUtils/commonBlocks/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkAtMostOneBodyBlockExists(
    documentUri: Uri,
    blocks: Block[]
): DiagnosticWithCode | undefined {
    const sortedBodyBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isBodyBlock(name))
    );

    if (sortedBodyBlocks.length > 1) {
        return getDiagnostic(documentUri, sortedBodyBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBodyBlocks: Block[]
): DiagnosticWithCode {
    return {
        message: "Too many 'body' blocks are defined.",
        range: mapRange(
            sortedBodyBlocks[sortedBodyBlocks.length - 1].nameRange
        ),
        relatedInformation: sortedBodyBlocks
            .slice(0, sortedBodyBlocks.length - 1)
            .map(({ name, nameRange }) => ({
                message: `Other body block with name '${name}'`,
                location: { uri: documentUri, range: mapRange(nameRange) },
            })),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.TooManyBodyBlocksDefined;
}
