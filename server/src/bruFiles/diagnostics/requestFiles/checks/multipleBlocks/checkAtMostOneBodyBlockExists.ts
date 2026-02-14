import { DiagnosticSeverity, Uri } from "vscode";
import { Block, isBodyBlock } from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { getSortedBlocksByPosition } from "../../../shared/util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkAtMostOneBodyBlockExists(
    documentUri: Uri,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const sortedBodyBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isBodyBlock(name)),
    );

    if (sortedBodyBlocks.length > 1) {
        return getDiagnostic(documentUri, sortedBodyBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBodyBlocks: Block[],
): DiagnosticWithCode {
    return {
        message: "Too many 'body' blocks are defined.",
        range: mapToVsCodeRange(
            sortedBodyBlocks[sortedBodyBlocks.length - 1].nameRange,
        ),
        relatedInformation: sortedBodyBlocks
            .slice(0, sortedBodyBlocks.length - 1)
            .map(({ name, nameRange }) => ({
                message: `Other body block with name '${name}'`,
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
    return NonBlockSpecificDiagnosticCode.TooManyBodyBlocksDefined;
}
