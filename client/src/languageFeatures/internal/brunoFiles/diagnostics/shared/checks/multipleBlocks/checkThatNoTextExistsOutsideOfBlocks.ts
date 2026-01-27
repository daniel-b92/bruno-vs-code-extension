import { DiagnosticSeverity, Range, Uri } from "vscode";
import {
    EnvironmentFileBlockName,
    getBlockStartPatternByName,
    getNonBlockSpecificBlockStartPattern,
    mapToVsCodePosition,
    mapToVsCodeRange,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
    TextDocumentHelper,
    TextOutsideOfBlocks,
} from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

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
            mapToVsCodePosition(relevantTextOutsideOfBlocks[0].range.start),
            mapToVsCodePosition(
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
                              range: mapToVsCodeRange(range),
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

    const docHelperForFirstText = new TextDocumentHelper(
        relevantTextOutsideOfBlocks[0].text,
    );

    const firstLineContainsBlockStart =
        docHelperForFirstText.getLineCount() >= 1
            ? getNonBlockSpecificBlockStartPattern().test(
                  docHelperForFirstText.getLineByIndex(0),
              )
            : false;

    if (!firstLineContainsBlockStart) {
        return commonMessage;
    }

    const blockWithStartMatchingFirstLine = (
        Object.values(RequestFileBlockName) as string[]
    )
        .concat(Object.values(SettingsFileSpecificBlock))
        .concat(Object.values(EnvironmentFileBlockName))
        .find((blockName) =>
            getBlockStartPatternByName(blockName).test(
                docHelperForFirstText.getLineByIndex(0),
            ),
        );

    return blockWithStartMatchingFirstLine
        ? `${commonMessage} Are you maybe missing a bracket for closing the block '${blockWithStartMatchingFirstLine}'?`
        : commonMessage;
}
