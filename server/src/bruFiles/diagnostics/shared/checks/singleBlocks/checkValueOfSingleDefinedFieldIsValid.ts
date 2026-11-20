import { DictionaryBlockSimpleField } from "@global_shared";
import { KnownDiagnosticCode } from "../../diagnosticCodes/knownDiagnosticCodeDefinition";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "./checkValueForDictionaryBlockSimpleFieldIsValid";

/**
 * In case of duplicate definitions, it's ambiguous which field is meant. That case is reported by another check.
 */
export function checkValueOfSingleDefinedFieldIsValid(
    allSimpleFields: DictionaryBlockSimpleField[],
    key: string,
    allowedValues: string[],
    diagnosticCode: KnownDiagnosticCode,
) {
    const fieldsWithKey = allSimpleFields.filter(({ key: k }) => k == key);

    return fieldsWithKey.length == 1
        ? checkValueForDictionaryBlockSimpleFieldIsValid(
              fieldsWithKey[0],
              allowedValues,
              diagnosticCode,
          )
        : undefined;
}
