import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
    Uri,
} from "vscode";
import {
    Block,
    castBlockToArrayBlock,
    mapPosition,
    mapRange,
    PlainTextWithinBlock,
    isArrayBlockField,
    getSortedBlocksByPosition,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedPlainTextLinesByPosition } from "../../util/getSortedPlainTextLinesByPosition";

export function checkArrayBlocksHaveArrayStructure(
    documentUri: Uri,
    blocksToCheck: Block[],
): DiagnosticWithCode | undefined {
    const sortedBlocksWithoutCorrectStructure = getSortedBlocksByPosition(
        blocksToCheck.filter((block) => !castBlockToArrayBlock(block)),
    );

    if (sortedBlocksWithoutCorrectStructure.length > 0) {
        return getDiagnostic(
            documentUri,
            sortedBlocksWithoutCorrectStructure.map((block) => ({
                blockName: block.name,
                invalidLines: getLinesWithInvalidStructure(
                    block,
                ) as PlainTextWithinBlock[],
            })),
        );
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBlocksWithIncorrectStructure: {
        blockName: string;
        invalidLines: PlainTextWithinBlock[];
    }[],
): DiagnosticWithCode {
    return {
        message: `At least one array block does not have the correct structure. A valid array block matches the following pattern:
<blockName> [
  entry1,
  entry2,
  entry3
]`,
        range: getRange(sortedBlocksWithIncorrectStructure),
        relatedInformation:
            sortedBlocksWithIncorrectStructure.length > 1 ||
            sortedBlocksWithIncorrectStructure[0].invalidLines.length > 1
                ? sortedBlocksWithIncorrectStructure.reduce(
                      (prev, curr) =>
                          prev.concat(
                              curr.invalidLines.map(({ range }) => ({
                                  message: `Invalid line in block '${curr.blockName}'`,
                                  location: {
                                      uri: documentUri,
                                      range: mapRange(range),
                                  },
                              })),
                          ),
                      [] as DiagnosticRelatedInformation[],
                  )
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.ArrayBlocksNotStructuredCorrectly,
    };
}

function getRange(
    sortedBlocksWithIncorrectStructure: {
        blockName: string;
        invalidLines: PlainTextWithinBlock[];
    }[],
): Range {
    const lastBlock =
        sortedBlocksWithIncorrectStructure[
            sortedBlocksWithIncorrectStructure.length - 1
        ];
    return new Range(
        mapPosition(
            getSortedPlainTextLinesByPosition(
                sortedBlocksWithIncorrectStructure[0].invalidLines,
            )[0].range.start,
        ),
        mapPosition(
            getSortedPlainTextLinesByPosition(lastBlock.invalidLines)[
                lastBlock.invalidLines.length - 1
            ].range.end,
        ),
    );
}

function getLinesWithInvalidStructure(block: Block) {
    return Array.isArray(block.content)
        ? (block.content.filter(
              (line) => !isArrayBlockField(line),
          ) as PlainTextWithinBlock[])
        : undefined;
}
