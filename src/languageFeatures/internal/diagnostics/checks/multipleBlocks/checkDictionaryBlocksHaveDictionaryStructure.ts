import { Diagnostic, DiagnosticSeverity, Range, Uri } from "vscode";
import { RequestFileBlock } from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { getSortedBlocksOrFieldsByPosition } from "../../util/getSortedBlocksOrFieldsByPosition";
import { shouldBeDictionaryBlock } from "../../util/shouldBeDictionaryBlock";
import { castBlockToDictionaryBlock } from "../../../../../shared/fileSystem/testFileParsing/internal/castBlockToDictionaryBlock";

export function checkDictionaryBlocksHaveDictionaryStructure(
    documentUri: Uri,
    blocks: RequestFileBlock[]
): Diagnostic | DiagnosticCode {
    const sortedBlocksWithoutCorrectStructure = getSortedBlocksOrFieldsByPosition(
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
): Diagnostic {
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
