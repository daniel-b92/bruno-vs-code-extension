import { DiagnosticSeverity, Range, Uri } from "vscode";
import {
    EnvironmentFileBlockName,
    mapPosition,
    mapRange,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
    TextOutsideOfBlocks,
} from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { getNonBlockSpecificBlockStartPattern } from "../../../../../../shared/fileParsing/internal/util/getNonBlockSpecificBlockStartPattern";
import { getBlockStartPatternByName } from "../../../../../../shared/fileParsing/internal/util/getBlockStartPatternByName";

export function checkThatNoTextExistsOutsideOfBlocks(
    documentUri: Uri,
    allTextOutsideOfBlocks: TextOutsideOfBlocks[],
): DiagnosticWithCode | undefined {
    const relevantTextOutsideOfBlocks = allTextOutsideOfBlocks.filter(
        ({ text }) => !/^\s*$/.test(text),
    );

    if (relevantTextOutsideOfBlocks.length == 0) {
        return undefined;
    } else {
        relevantTextOutsideOfBlocks.sort(
            (
                {
                    range: {
                        start: { line: line1 },
                    },
                },
                {
                    range: {
                        start: { line: line2 },
                    },
                },
            ) => line1 - line2,
        );

        const range = new Range(
            mapPosition(relevantTextOutsideOfBlocks[0].range.start),
            mapPosition(
                relevantTextOutsideOfBlocks[
                    relevantTextOutsideOfBlocks.length - 1
                ].range.end,
            ),
        );

        const diagnostic: DiagnosticWithCode = {
            message: getMessage(relevantTextOutsideOfBlocks),
            range,
            relatedInformation:
                relevantTextOutsideOfBlocks.length > 1
                    ? relevantTextOutsideOfBlocks.map(({ range }) => ({
                          message: `Text outside of blocks`,
                          location: {
                              uri: documentUri,
                              range: mapRange(range),
                          },
                      }))
                    : undefined,
            severity: DiagnosticSeverity.Error,
            code: NonBlockSpecificDiagnosticCode.TextOutsideOfBlocks,
        };

        return diagnostic;
    }
}

function getMessage(relevantTextOutsideOfBlocks: TextOutsideOfBlocks[]) {
    const commonMessage = "Text outside of blocks is not allowed.";
    const startOfTextMatchesBlockStart =
        relevantTextOutsideOfBlocks[0].text.match(
            getNonBlockSpecificBlockStartPattern(),
        )
            ? true
            : false;

    if (!startOfTextMatchesBlockStart) {
        return commonMessage;
    }

    const blockWithMissingClosingBracket = (
        Object.values(RequestFileBlockName) as string[]
    )
        .concat(Object.values(SettingsFileSpecificBlock))
        .concat(Object.values(EnvironmentFileBlockName))
        .find((blockName) =>
            relevantTextOutsideOfBlocks[0].text.match(
                getBlockStartPatternByName(blockName),
            ),
        );

    return blockWithMissingClosingBracket
        ? `${commonMessage} Are you maybe missing a bracket for closing the block '${blockWithMissingClosingBracket}'?`
        : commonMessage;
}
