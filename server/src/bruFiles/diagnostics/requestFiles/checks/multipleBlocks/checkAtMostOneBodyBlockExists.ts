import {
    Block,
    canBlockBeDefinedMultipleTimes,
    isBodyBlock,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../../shared/util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkAtMostOneBodyBlockExists(
    filePath: string,
    blocks: Block[],
): DiagnosticWithCode | undefined {
    const sortedBodyBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => isBodyBlock(name)),
    );
    const sortedBodyBlocksWithoutRepeats =
        withoutAdditionalRepeatableBlocks(sortedBodyBlocks);

    if (sortedBodyBlocksWithoutRepeats.length > 1) {
        return getDiagnostic(filePath, sortedBodyBlocksWithoutRepeats);
    } else {
        return undefined;
    }
}

/**
 * Body blocks that can be defined multiple times (e.g. websocket messages) are only counted as a single body.
 */
function withoutAdditionalRepeatableBlocks(sortedBodyBlocks: Block[]) {
    return sortedBodyBlocks.filter(
        (block, index) =>
            !canBlockBeDefinedMultipleTimes(block.name) ||
            sortedBodyBlocks.findIndex(({ name }) => name == block.name) ==
                index,
    );
}

function getDiagnostic(
    filePath: string,
    sortedBodyBlocks: Block[],
): DiagnosticWithCode {
    return {
        message: "Too many 'body' blocks are defined.",
        range: sortedBodyBlocks[sortedBodyBlocks.length - 1].nameRange,
        relatedInformation: sortedBodyBlocks
            .slice(0, sortedBodyBlocks.length - 1)
            .map(({ name, nameRange }) => ({
                message: `Other body block with name '${name}'`,
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
    return NonBlockSpecificDiagnosticCode.TooManyBodyBlocksDefined;
}
