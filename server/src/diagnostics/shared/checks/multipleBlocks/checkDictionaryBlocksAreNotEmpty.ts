import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
    Uri,
} from "vscode";
import { Block, mapPosition, mapRange } from "../../../../sharedred";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkDictionaryBlocksAreNotEmpty(
    documentUri: Uri,
    blocksToCheck: Block[]
): DiagnosticWithCode | undefined {
    const sortedEmptyBlocks = getSortedBlocksByPosition(
        blocksToCheck.filter(
            ({ content }) => Array.isArray(content) && content.length == 0
        )
    );

    if (sortedEmptyBlocks.length == 0) {
        return undefined;
    }

    return sortedEmptyBlocks.length > 0
        ? getDiagnostic(documentUri, sortedEmptyBlocks)
        : undefined;
}

function getDiagnostic(
    documentUri: Uri,
    sortedEmptyBlocks: Block[]
): DiagnosticWithCode {
    return {
        message: `Dictionary blocks without content are invalid`,
        range: mapRange(
            new Range(
                mapPosition(sortedEmptyBlocks[0].nameRange.start),
                mapPosition(
                    sortedEmptyBlocks[sortedEmptyBlocks.length - 1].nameRange
                        .end
                )
            )
        ),
        relatedInformation:
            sortedEmptyBlocks.length > 1
                ? (sortedEmptyBlocks.map(({ name, nameRange }) => ({
                      message: `Dictionary block '${name}' without any content`,
                      location: {
                          uri: documentUri,
                          range: mapRange(nameRange),
                      },
                  })) as DiagnosticRelatedInformation[])
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.DictionaryBlocksWithoutContent,
    };
}
