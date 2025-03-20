import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode";
import { TextLineSplitterUtility } from "../../../../shared/fileSystem/testFileParsing/definitions/interfaces";

export function getDiagnosticForMissingMetaBlock(
    document: TextLineSplitterUtility
): Diagnostic {
    const lastLine = document.getLineByIndex(document.getLineCount() - 1);

    return {
        message: "No 'meta' block defined.",
        range: new Range(
            new Position(0, 0),
            new Position(document.getLineCount() - 1, lastLine.length)
        ),
        severity: DiagnosticSeverity.Error,
        code: "bruLang_MissingMetaBlock",
    };
}
