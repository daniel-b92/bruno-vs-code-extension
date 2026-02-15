import { Block, Range } from "@global_shared";
import { getSortedBlocksByPosition } from "../../util/getSortedBlocksByPosition";
import { DiagnosticWithCode } from "../../../interfaces";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { URI } from "vscode-uri";
import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
} from "vscode-languageserver";

export function checkDictionaryBlocksAreNotEmpty(
    filePath: string,
    blocksToCheck: Block[],
): DiagnosticWithCode | undefined {
    const sortedEmptyBlocks = getSortedBlocksByPosition(
        blocksToCheck.filter(
            ({ content }) => Array.isArray(content) && content.length == 0,
        ),
    );

    if (sortedEmptyBlocks.length == 0) {
        return undefined;
    }

    return sortedEmptyBlocks.length > 0
        ? getDiagnostic(filePath, sortedEmptyBlocks)
        : undefined;
}

function getDiagnostic(
    filePath: string,
    sortedEmptyBlocks: Block[],
): DiagnosticWithCode {
    return {
        message: `Dictionary blocks without content are invalid`,
        range: new Range(
            sortedEmptyBlocks[0].nameRange.start,
            sortedEmptyBlocks[sortedEmptyBlocks.length - 1].nameRange.end,
        ),
        relatedInformation:
            sortedEmptyBlocks.length > 1
                ? (sortedEmptyBlocks.map(({ name, nameRange }) => ({
                      message: `Dictionary block '${name}' without any content`,
                      location: {
                          uri: URI.file(filePath).toString(),
                          range: nameRange,
                      },
                  })) as DiagnosticRelatedInformation[])
                : undefined,
        severity: DiagnosticSeverity.Error,
        code: NonBlockSpecificDiagnosticCode.DictionaryBlocksWithoutContent,
    };
}
