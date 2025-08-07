import { DiagnosticSeverity, Uri } from "vscode";
import { Block, mapRange } from "../../../../sharedred";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getRangeContainingBlocksSortedByPosition } from "../../util/getRangeContainingBlocksSortedByPosition";

export function checkNoRedundantBlocksExist(
    documentUri: Uri,
    blocks: Block[],
    redundantBlockNames: string[],
): DiagnosticWithCode | undefined {
    const redundantBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => redundantBlockNames.includes(name)),
    );

    if (redundantBlocks.length > 0) {
        return getDiagnostic(documentUri, redundantBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    sortedRedundantBlocks: Block[],
): DiagnosticWithCode {
    return {
        message:
            sortedRedundantBlocks.length > 1
                ? "Redundant blocks are defined."
                : "Redundant block.",
        range: mapRange(
            getRangeContainingBlocksSortedByPosition(sortedRedundantBlocks),
        ),
        relatedInformation:
            sortedRedundantBlocks.length > 1
                ? sortedRedundantBlocks.map(({ name, nameRange }) => ({
                      message: `Redundant block '${name}'`,
                      location: {
                          uri: documentUri,
                          range: mapRange(nameRange),
                      },
                  }))
                : undefined,
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.RedundantBlocksDefined,
    };
}
