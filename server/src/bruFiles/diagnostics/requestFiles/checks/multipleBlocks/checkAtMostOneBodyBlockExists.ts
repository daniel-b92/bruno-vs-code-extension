import { Block, isBodyBlock, RequestFileBlockName } from "@global_shared";
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
    const sortedBodyBlocksWithoutAdditionalWsMessages =
        withoutAdditionalWsMessageBlocks(sortedBodyBlocks);

    if (sortedBodyBlocksWithoutAdditionalWsMessages.length > 1) {
        return getDiagnostic(
            filePath,
            sortedBodyBlocksWithoutAdditionalWsMessages,
        );
    } else {
        return undefined;
    }
}

/**
 * Websocket requests can have multiple messages, which are defined as separate body blocks.
 * Therefore, all of the `body:ws` blocks together are only counted as a single body.
 */
function withoutAdditionalWsMessageBlocks(sortedBodyBlocks: Block[]) {
    const firstWsBlock = sortedBodyBlocks.find(
        ({ name }) => name == RequestFileBlockName.WsBody,
    );

    return sortedBodyBlocks.filter(
        (block) =>
            block.name != RequestFileBlockName.WsBody || block == firstWsBlock,
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
