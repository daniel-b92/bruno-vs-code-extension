import { Block, Range, TextOutsideOfBlocks } from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedTextOutsideOfBlocksByPosition } from "../../util/getSortedTextOutsideOfBlocksByPosition";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

export function checkBlocksAreSeparatedBySingleEmptyLine(
    filePath: string,
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
        return getDiagnostic(filePath, problematicTextOutsideOfBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    filePath: string,
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
                          uri: URI.file(filePath).toString(),
                          range: range,
                      },
                  })),
        code: NonBlockSpecificDiagnosticCode.BlocksNotAllSeparatedBySingleEmptyLine,
    };
}

function getRange(
    problematicTextOutsideOfBlocksSortedByPosition: TextOutsideOfBlocks[],
): Range {
    return new Range(
        problematicTextOutsideOfBlocksSortedByPosition[0].range.start,
        problematicTextOutsideOfBlocksSortedByPosition[
            problematicTextOutsideOfBlocksSortedByPosition.length - 1
        ].range.end,
    );
}
