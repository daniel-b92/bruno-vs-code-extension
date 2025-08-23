import { DiagnosticSeverity, Range, Uri } from "vscode";
import {
    Block,
    mapToVsCodePosition,
    mapToVsCodeRange,
    TextOutsideOfBlocks,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedTextOutsideOfBlocksByPosition } from "../../util/getSortedTextOutsideOfBlocksByPosition";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";

export function checkBlocksAreSeparatedBySingleEmptyLine(
    documentUri: Uri,
    blocks: Block[],
    textOutsideOfBlocks: TextOutsideOfBlocks[],
): DiagnosticWithCode | undefined {
    if (blocks.length < 2) {
        // Only check text outside of blocks that is in between two blocks.
        return undefined;
    }

    const blocksSortedByPosition = getSortedBlocksByPosition(blocks.slice());

    const problematicTextOutsideOfBlocks = textOutsideOfBlocks.filter(
        ({ text, range }) =>
            !/^(\r\n\r\n|\n\n)$/.test(text) &&
            range.start.isBefore(
                blocksSortedByPosition[blocksSortedByPosition.length - 1]
                    .nameRange.start,
            ),
    );

    if (problematicTextOutsideOfBlocks.length > 0) {
        return getDiagnostic(documentUri, problematicTextOutsideOfBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    problematicTextOutsideOfBlocks: TextOutsideOfBlocks[],
): DiagnosticWithCode {
    const sortedTextOutsideOfBlocks = getSortedTextOutsideOfBlocksByPosition(
        problematicTextOutsideOfBlocks,
    );

    return {
        message: "Blocks are not separated by a single empty line.",
        range: getRange(problematicTextOutsideOfBlocks),
        severity: DiagnosticSeverity.Warning,
        relatedInformation:
            problematicTextOutsideOfBlocks.length == 1
                ? undefined
                : sortedTextOutsideOfBlocks.map(({ range }) => ({
                      message: "Problematic text outside of blocks.",
                      location: {
                          uri: documentUri,
                          range: mapToVsCodeRange(range),
                      },
                  })),
        code: NonBlockSpecificDiagnosticCode.BlocksNotAllSeparatedBySingleEmptyLine,
    };
}

function getRange(
    problematicTextOutsideOfBlocksSortedByPosition: TextOutsideOfBlocks[],
): Range {
    return new Range(
        mapToVsCodePosition(
            problematicTextOutsideOfBlocksSortedByPosition[0].range.start,
        ),
        mapToVsCodePosition(
            problematicTextOutsideOfBlocksSortedByPosition[
                problematicTextOutsideOfBlocksSortedByPosition.length - 1
            ].range.end,
        ),
    );
}
