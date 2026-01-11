import { DictionaryBlockSimpleField } from "../../../../../../../shared";
import { DiagnosticWithCode } from "../../../definitions";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { getDiagnosticForInvalidDictionaryBlockSimpleFieldValue } from "../../util/getDiagnosticForInvalidDictionaryBlockSimpleFieldValue";

export function checkValueForDictionaryBlockSimpleFieldIsValid(
    field: DictionaryBlockSimpleField,
    allowedValues: string[],
    diagnosticCode: KnownDiagnosticCode,
): DiagnosticWithCode | undefined {
    if (!allowedValues.includes(field.value)) {
        return getDiagnosticForInvalidDictionaryBlockSimpleFieldValue(
            field,
            `Allowed values are ${JSON.stringify(allowedValues, null, 2)}`,
            diagnosticCode,
        );
    } else {
        return undefined;
    }
}
