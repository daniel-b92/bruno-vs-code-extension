import { Position, Range, ScriptType, ParsedRequestFile } from "@global_shared";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../../interfaces";

export function checkResponseValidationExists(
    runtime: ParsedRequestFile["properties"]["runtime"],
    { docHelper }: CommonDiagnosticParams,
): Diagnostic | undefined {
    const { assertions, scripts } = runtime?.properties ?? {};

    const validationExists =
        (assertions && assertions.enabled.length > 0) ||
        scripts?.some(
            ({ properties: { type } }) =>
                type?.value == ScriptType.AfterResponse ||
                type?.value == ScriptType.Tests,
        );

    if (validationExists) {
        return undefined;
    }

    const lastLineIndex = docHelper.getLineCount() - 1;

    return {
        message: `No 'assertions', '${ScriptType.AfterResponse}' script or '${ScriptType.Tests}' script is defined.`,
        range: new Range(
            new Position(lastLineIndex, 0),
            new Position(
                lastLineIndex,
                docHelper.getLineByIndex(lastLineIndex).length,
            ),
        ),
        severity: DiagnosticSeverity.Warning,
    };
}
