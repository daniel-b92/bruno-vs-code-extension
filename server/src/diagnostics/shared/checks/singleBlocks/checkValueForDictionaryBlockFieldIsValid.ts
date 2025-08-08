import { DiagnosticSeverity } from "vscode";
import { DictionaryBlockField, mapRange } from "../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";

export function checkValueForDictionaryBlockFieldIsValid(
    field: DictionaryBlockField,
    allowedValues: string[],
    diagnosticCode: KnownDiagnosticCode,
): DiagnosticWithCode | undefined {
    if (!allowedValues.includes(field.value)) {
        return getDiagnostic(field, allowedValues, diagnosticCode);
    } else {
        return undefined;
    }
}

function getDiagnostic(
    field: DictionaryBlockField,
    allowedValues: string[],
    diagnosticCode: KnownDiagnosticCode,
) {
    return {
        message: `Invalid value '${
            field.value
        }'. Allowed values are ${JSON.stringify(allowedValues, null, 2)}`,
        range: mapRange(field.valueRange),
        severity: DiagnosticSeverity.Error,
        code: diagnosticCode,
    };
}
