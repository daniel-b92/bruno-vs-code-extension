import { Diagnostic, DiagnosticSeverity, Position, Range } from "vscode";
import { TextLineSplitterUtility } from "../../../../shared/fileSystem/testFileParsing/definitions/interfaces";

export function getDiagnosticForMetaBlockNotInFirstLine(
    document: TextLineSplitterUtility
): Diagnostic {
    return {
        message: "Should start with the 'meta' block",
        range: new Range(
            new Position(0, 0),
            new Position(0, document.getLineByIndex(0).length)
        ),
        severity: DiagnosticSeverity.Warning,
        code: "bruLang_MetaBlockNotInFirstLine",
    };
}
