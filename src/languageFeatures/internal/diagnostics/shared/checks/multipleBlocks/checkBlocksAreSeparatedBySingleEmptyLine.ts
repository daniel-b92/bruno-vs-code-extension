import { DiagnosticSeverity, Range, Uri } from "vscode";
import { TextOutsideOfBlocks } from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getSortedTextOutsideOfBlocksByPosition } from "../../util/getSortedTextOutsideOfBlocksByPosition";

export function checkBlocksAreSeparatedBySingleEmptyLine(
    documentUri: Uri,
    textOutsideOfBlocks: TextOutsideOfBlocks[]
): DiagnosticWithCode | undefined {
    const problematicTextOutsideOfBlocks = textOutsideOfBlocks.filter(
        ({ text }) => !/^(\r\n\r\n|\n\n)$/.test(text)
    );

    if (problematicTextOutsideOfBlocks.length > 0) {
        return getDiagnostic(documentUri, problematicTextOutsideOfBlocks);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    documentUri: Uri,
    problematicTextOutsideOfBlocks: TextOutsideOfBlocks[]
): DiagnosticWithCode {
    const sortedTextOutsideOfBlocks = getSortedTextOutsideOfBlocksByPosition(
        problematicTextOutsideOfBlocks
    );

    return {
        message: "Blocks are not separated by a single empty line.",
        range: getRange(problematicTextOutsideOfBlocks),
        severity: DiagnosticSeverity.Warning,
        relatedInformation:
            problematicTextOutsideOfBlocks.length == 1
                ? undefined
                : sortedTextOutsideOfBlocks.map(({ range }) => ({
                      message: "Problematic text outside of blocks.",
                      location: { uri: documentUri, range },
                  })),
        code: NonBlockSpecificDiagnosticCode.BlocksNotAllSeparatedBySingleEmptyLine,
    };
}

function getRange(
    problematicTextOutsideOfBlocksSortedByPosition: TextOutsideOfBlocks[]
): Range {
    return new Range(
        problematicTextOutsideOfBlocksSortedByPosition[0].range.start,
        problematicTextOutsideOfBlocksSortedByPosition[
            problematicTextOutsideOfBlocksSortedByPosition.length - 1
        ].range.end
    );
}
