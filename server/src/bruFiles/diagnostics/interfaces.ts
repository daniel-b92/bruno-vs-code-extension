import { Diagnostic } from "vscode-languageserver";
import { KnownDiagnosticCode } from "./shared/diagnosticCodes/knownDiagnosticCodeDefinition";

export type DiagnosticWithCode = Diagnostic & {
    code: KnownDiagnosticCode;
};
