import { DiagnosticSeverity, Range, Uri } from "vscode";
import {
    RequestFileBlock,
    castBlockToDictionaryBlock,
} from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { shouldBeDictionaryBlock } from "../../util/shouldBeDictionaryBlock";
import { DiagnosticWithCode } from "../../definitions";

export function checkDictionaryBlocksHaveDictionaryStructure(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): DiagnosticWithCode | DiagnosticCode {
    const sortedBlocksWithoutCorrectStructure = getSortedBlocksByPosition(
        blocks.filter(
            (block) =>
                shouldBeDictionaryBlock(block.name) &&
                !castBlockToDictionaryBlock(block)
        )
    );

    if (sortedBlocksWithoutCorrectStructure.length > 0) {
        return getDiagnostic(documentUri, sortedBlocksWithoutCorrectStructure);
    } else {
        return DiagnosticCode.DictionaryBlocksNotStructuredCorrectly;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBlocksWithIncorrectStructure: RequestFileBlock[]
): DiagnosticWithCode {
    return {
        message:
            "At least one dictionary block does not have the correct structure.",
        range: getRange(sortedBlocksWithIncorrectStructure),
        relatedInformation:
            sortedBlocksWithIncorrectStructure.length > 1
                ? sortedBlocksWithIncorrectStructure.map(
                      ({ name, contentRange }) => ({
                          message: `Dictionary block with name '${name}'`,
                          location: { uri: documentUri, range: contentRange },
                      })
                  )
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.DictionaryBlocksNotStructuredCorrectly,
    };
}

function getRange(
    sortedBlocksWithIncorrectStructure: RequestFileBlock[]
): Range {
    return new Range(
        sortedBlocksWithIncorrectStructure[0].contentRange.start,
        sortedBlocksWithIncorrectStructure[
            sortedBlocksWithIncorrectStructure.length - 1
        ].contentRange.end
    );
}
