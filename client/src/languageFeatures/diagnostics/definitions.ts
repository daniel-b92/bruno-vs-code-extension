import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
} from "vscode";
import { KnownDiagnosticCode } from "./shared/diagnosticCodes/knownDiagnosticCodeDefinition";

export interface DiagnosticWithCode {
    range: Range;
    message: string;
    severity: DiagnosticSeverity;
    code: KnownDiagnosticCode;
    relatedInformation?: DiagnosticRelatedInformation[];
}
