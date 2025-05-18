import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
    Uri,
} from "vscode";
import {
    Block,
    castBlockToDictionaryBlock,
    mapPosition,
    mapRange,
    PlainTextWithinBlock,
} from "../../../../../../shared";
import { getSortedBlocksByPosition } from "../../../shared/util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { isDictionaryBlockField } from "../../../../../../shared/fileParsing/internal/util/isDictionaryBlockField";

export function checkDictionaryBlocksHaveDictionaryStructure(
    documentUri: Uri,
    blocksToCheck: Block[]
): DiagnosticWithCode | undefined {
    const sortedBlocksWithoutCorrectStructure = getSortedBlocksByPosition(
        blocksToCheck.filter((block) => !castBlockToDictionaryBlock(block))
    );

    if (sortedBlocksWithoutCorrectStructure.length > 0) {
        return getDiagnostic(
            documentUri,
            sortedBlocksWithoutCorrectStructure.map((block) => ({
                blockName: block.name,
                invalidLines: getLinesWithInvalidStructure(
                    block
                ) as PlainTextWithinBlock[],
            }))
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
    }[]
): DiagnosticWithCode {
    return {
        message:
            "At least one dictionary block does not have the correct structure.",
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
                              }))
                          ),
                      [] as DiagnosticRelatedInformation[]
                  )
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: getCode(),
    };
}

function getLinesWithInvalidStructure(block: Block) {
    return Array.isArray(block.content)
        ? (block.content.filter(
              (line) => !isDictionaryBlockField(line)
          ) as PlainTextWithinBlock[])
        : undefined;
}

function getRange(
    sortedBlocksWithIncorrectStructure: {
        blockName: string;
        invalidLines: PlainTextWithinBlock[];
    }[]
): Range {
    const lastBlock =
        sortedBlocksWithIncorrectStructure[
            sortedBlocksWithIncorrectStructure.length - 1
        ];
    return new Range(
        mapPosition(
            sortLinesByPosition(
                sortedBlocksWithIncorrectStructure[0].invalidLines
            )[0].range.start
        ),
        mapPosition(
            sortLinesByPosition(lastBlock.invalidLines)[
                lastBlock.invalidLines.length - 1
            ].range.end
        )
    );
}

function sortLinesByPosition(plainTextLines: PlainTextWithinBlock[]) {
    return plainTextLines.sort(
        ({ range: range1 }, { range: range2 }) =>
            range1.start.line - range2.start.line
    );
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.DictionaryBlocksNotStructuredCorrectly;
}
