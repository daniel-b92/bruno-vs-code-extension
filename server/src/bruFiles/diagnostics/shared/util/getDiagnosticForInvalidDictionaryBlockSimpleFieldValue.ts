import { DictionaryBlockSimpleField } from "@global_shared";
import { KnownDiagnosticCode } from "../diagnosticCodes/knownDiagnosticCodeDefinition";
import { DiagnosticSeverity } from "vscode-languageserver";
import { DiagnosticWithCode } from "../../interfaces";

export function getDiagnosticForInvalidDictionaryBlockSimpleFieldValue(
    field: DictionaryBlockSimpleField,
    messageDescribingWhichValuesAreAllowed: string,
    diagnosticCode: KnownDiagnosticCode,
): DiagnosticWithCode {
    return {
        message: `Invalid value '${
            field.value
        }'. ${messageDescribingWhichValuesAreAllowed}`,
        range: field.valueRange,
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}
