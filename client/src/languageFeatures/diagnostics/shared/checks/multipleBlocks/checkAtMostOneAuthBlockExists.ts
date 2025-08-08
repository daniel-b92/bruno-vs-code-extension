import { DiagnosticSeverity, Uri } from "vscode";
import { isAuthBlock, Block, mapRange } from "../../../../../../../shared";
import { getSortedBlocksByPosition } from "../../../../../../../shared/languageUtils/commonBlocks/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkAtMostOneAuthBlockExists(
    documentUri: Uri,
    blocks: Block[]
): DiagnosticWithCode | undefined {
    const sortedAuthBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isAuthBlock(name))
    );

    if (sortedAuthBlocks.length > 1) {
        return getDiagnostic(documentUri, sortedAuthBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedAuthBlocks: Block[]
): DiagnosticWithCode {
    return {
        message: "Too many 'auth' blocks are defined.",
        range: mapRange(
            sortedAuthBlocks[sortedAuthBlocks.length - 1].nameRange
        ),
        relatedInformation: sortedAuthBlocks
            .slice(0, sortedAuthBlocks.length - 1)
            .map(({ name, nameRange }) => ({
                message: `Other auth block with name '${name}'`,
                location: { uri: documentUri, range: mapRange(nameRange) },
            })),
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.TooManyAuthBlocksDefined;
}
