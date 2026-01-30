import { DiagnosticSeverity } from "vscode";
import { DictionaryBlockSimpleField } from "@global_shared";
import { mapToVsCodeRange } from "@shared";
import { KnownDiagnosticCode } from "../diagnosticCodes/knownDiagnosticCodeDefinition";

export function getDiagnosticForInvalidDictionaryBlockSimpleFieldValue(
    field: DictionaryBlockSimpleField,
    messageDescribingWhichValuesAreAllowed: string,
    diagnosticCode: KnownDiagnosticCode,
) {
    return {
        message: `Invalid value '${
            field.value
        }'. ${messageDescribingWhichValuesAreAllowed}`,
        range: mapToVsCodeRange(field.valueRange),
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}
