import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
} from "vscode";
import { KnownDiagnosticCode } from "./diagnosticCodes/knownDiagnosticCodeEnum";

export interface DiagnosticWithCode {
    range: Range;
    message: string;
    severity: DiagnosticSeverity;
    code: KnownDiagnosticCode;
    relatedInformation?: DiagnosticRelatedInformation[];
}
