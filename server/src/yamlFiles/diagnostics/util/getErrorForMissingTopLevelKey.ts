import { Diagnostic } from "vscode-languageserver";
import { CommonDiagnosticParams } from "../../interfaces";

export function getErrorForMissingTopLevelKey(
    key: string,
    { fullDocumentRange }: CommonDiagnosticParams,
): Diagnostic {
    return {
        message: `Mandatory top-level key '${key}' missing.`,
        range: fullDocumentRange,
    };
}
