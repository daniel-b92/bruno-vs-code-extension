import { DiagnosticSeverity, Range, Uri } from "vscode";
import { TextOutsideOfBlocks } from "../../../../../shared";
import { DiagnosticWithCode } from "../../definitions";
import { NonBlockSpecificDiagnosticCode } from "../../diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";

export function checkThatNoTextExistsOutsideOfBlocks(
    documentUri: Uri,
    allTextOutsideOfBlocks: TextOutsideOfBlocks[]
): DiagnosticWithCode | undefined {
    const relevantTextOutsideOfBlocks = allTextOutsideOfBlocks.filter(
        ({ text }) => !/^\s*$/.test(text)
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
                }
            ) => line1 - line2
        );

        const range = new Range(
            relevantTextOutsideOfBlocks[0].range.start,
            relevantTextOutsideOfBlocks[
                relevantTextOutsideOfBlocks.length - 1
            ].range.end
        );

        const diagnostic: DiagnosticWithCode = {
            message: "Text outside of blocks is not allowed.",
            range,
            relatedInformation: relevantTextOutsideOfBlocks.map(
                ({ range }) => ({
                    message: `Text outside of blocks`,
                    location: {
                        uri: documentUri,
                        range,
                    },
                })
            ),
            severity: DiagnosticSeverity.Error,
            code: getCode(),
        };

        return diagnostic;
    }
}

function getCode() {
    return NonBlockSpecificDiagnosticCode.TextOutsideOfBlocks;
}
