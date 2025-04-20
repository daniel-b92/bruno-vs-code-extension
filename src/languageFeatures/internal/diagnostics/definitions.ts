import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Range,
} from "vscode";
import { DiagnosticCode } from "./diagnosticCodeEnum";

export interface DiagnosticWithCode {
    range: Range;
    message: string;
    severity: DiagnosticSeverity;
    code: DiagnosticCode;
    relatedInformation?: DiagnosticRelatedInformation[];
}
