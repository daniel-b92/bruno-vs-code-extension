import { Block } from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getRangeContainingBlocksSortedByPosition } from "../../util/getRangeContainingBlocksSortedByPosition";
import { URI } from "vscode-uri";
import { DiagnosticSeverity } from "vscode-languageserver";

export function checkNoRedundantBlocksExist(
    filePath: string,
    blocks: Block[],
    redundantBlockNames: string[],
): DiagnosticWithCode | undefined {
    const redundantBlocks = getSortedBlocksByPosition(
        blocks.filter(({ name }) => redundantBlockNames.includes(name)),
    );

    if (redundantBlocks.length > 0) {
        return getDiagnostic(filePath, redundantBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    filePath: string,
    sortedRedundantBlocks: Block[],
): DiagnosticWithCode {
    return {
        message:
            sortedRedundantBlocks.length > 1
                ? "Redundant blocks are defined."
                : "Redundant block.",
        range: getRangeContainingBlocksSortedByPosition(sortedRedundantBlocks),
        relatedInformation:
            sortedRedundantBlocks.length > 1
                ? sortedRedundantBlocks.map(({ name, nameRange }) => ({
                      message: `Redundant block '${name}'`,
                      location: {
                          uri: URI.file(filePath).toString(),
                          range: nameRange,
                      },
                  }))
                : undefined,
        severity: DiagnosticSeverity.Warning,
        code: NonBlockSpecificDiagnosticCode.RedundantBlocksDefined,
    };
}
