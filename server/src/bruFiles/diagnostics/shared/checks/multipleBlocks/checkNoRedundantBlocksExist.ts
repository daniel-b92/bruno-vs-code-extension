import { DiagnosticSeverity, Uri } from "vscode";
import { Block } from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
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
        range: mapToVsCodeRange(
            getRangeContainingBlocksSortedByPosition(sortedRedundantBlocks),
        ),
        relatedInformation:
            sortedRedundantBlocks.length > 1
                ? sortedRedundantBlocks.map(({ name, nameRange }) => ({
                      message: `Redundant block '${name}'`,
                      location: {
                          uri: documentUri,
                          range: mapToVsCodeRange(nameRange),
                      },
                  }))
                : undefined,
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.RedundantBlocksDefined,
    };
}
