import {
    Block,
    isArrayBlockField,
    isBlockArrayBlock,
    PlainTextWithinBlock,
    Range,
} from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedPlainTextLinesByPosition } from "../../util/getSortedPlainTextLinesByPosition";
import { URI } from "vscode-uri";
import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
} from "vscode-languageserver";

export function checkArrayBlocksHaveArrayStructure(
    filePath: string,
    blocksToCheck: Block[],
): DiagnosticWithCode | undefined {
    const sortedBlocksWithoutCorrectStructure = getSortedBlocksByPosition(
        blocksToCheck.filter((block) => !isBlockArrayBlock(block)),
    );

    if (sortedBlocksWithoutCorrectStructure.length > 0) {
        return getDiagnostic(
            filePath,
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
    filePath: string,
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
                                      uri: URI.file(filePath).toString(),
                                      range,
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
        getSortedPlainTextLinesByPosition(
            sortedBlocksWithIncorrectStructure[0].invalidLines,
        )[0].range.start,
        getSortedPlainTextLinesByPosition(lastBlock.invalidLines)[
            lastBlock.invalidLines.length - 1
        ].range.end,
    );
}

function getLinesWithInvalidStructure(block: Block) {
    return Array.isArray(block.content)
        ? (block.content.filter(
              (line) => !isArrayBlockField(line),
          ) as PlainTextWithinBlock[])
        : undefined;
}
