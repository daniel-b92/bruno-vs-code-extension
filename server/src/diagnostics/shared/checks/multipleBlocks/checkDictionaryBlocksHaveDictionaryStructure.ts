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
    isDictionaryBlockField,
    getSortedBlocksByPosition,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedPlainTextLinesByPosition } from "../../util/getSortedPlainTextLinesByPosition";

export function checkDictionaryBlocksHaveDictionaryStructure(
    documentUri: Uri,
    blocksToCheck: Block[],
): DiagnosticWithCode | undefined {
    const sortedBlocksWithoutCorrectStructure = getSortedBlocksByPosition(
        blocksToCheck.filter((block) => !castBlockToDictionaryBlock(block)),
    );

    if (sortedBlocksWithoutCorrectStructure.length == 0) {
        return undefined;
    }

    const invalidBlocksSorted = sortedBlocksWithoutCorrectStructure
        .map((block) => ({
            blockName: block.name,
            invalidLines: getLinesWithInvalidStructure(block) ?? [],
        }))
        .filter(({ invalidLines }) => invalidLines.length > 0);

    return invalidBlocksSorted.length > 0
        ? getDiagnostic(documentUri, invalidBlocksSorted)
        : undefined;
}

function getDiagnostic(
    documentUri: Uri,
    sortedBlocksWithIncorrectStructure: {
        blockName: string;
        invalidLines: PlainTextWithinBlock[];
    }[],
): DiagnosticWithCode {
    return {
        message: `At least one dictionary block does not have the correct structure. A valid dictionary block matches the following pattern:
<blockName> {
  key1: value1
  key2: value2
}`,
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
        code: getCode(),
    };
}

function getLinesWithInvalidStructure(block: Block) {
    return Array.isArray(block.content)
        ? (block.content.filter(
              (line) => !isDictionaryBlockField(line),
          ) as PlainTextWithinBlock[])
        : undefined;
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

function getCode() {
    return NonBlockSpecificDiagnosticCode.DictionaryBlocksNotStructuredCorrectly;
}
