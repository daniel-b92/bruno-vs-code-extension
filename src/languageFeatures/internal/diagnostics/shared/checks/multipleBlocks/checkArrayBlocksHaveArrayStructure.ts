import { DiagnosticSeverity, Range, Uri } from "vscode";
import { Block, castBlockToArrayBlock } from "../../../../../../shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkArrayBlocksHaveArrayStructure(
    documentUri: Uri,
    blocksToCheck: Block[]
): DiagnosticWithCode | undefined {
    const sortedBlocksWithoutCorrectStructure = getSortedBlocksByPosition(
        blocksToCheck.filter((block) => !castBlockToArrayBlock(block))
    );

    if (sortedBlocksWithoutCorrectStructure.length > 0) {
        return getDiagnostic(documentUri, sortedBlocksWithoutCorrectStructure);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedBlocksWithIncorrectStructure: Block[]
): DiagnosticWithCode {
    return {
        message:
            "At least one array block does not have the correct structure.",
        range: getRange(sortedBlocksWithIncorrectStructure),
        relatedInformation:
            sortedBlocksWithIncorrectStructure.length > 1
                ? sortedBlocksWithIncorrectStructure.map(
                      ({ name, contentRange }) => ({
                          message: `Array block with name '${name}'`,
                          location: { uri: documentUri, range: contentRange },
                      })
                  )
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.ArrayBlocksNotStructuredCorrectly,
    };
}

function getRange(sortedBlocksWithIncorrectStructure: Block[]): Range {
    return new Range(
        sortedBlocksWithIncorrectStructure[0].contentRange.start,
        sortedBlocksWithIncorrectStructure[
            sortedBlocksWithIncorrectStructure.length - 1
        ].contentRange.end
    );
}
