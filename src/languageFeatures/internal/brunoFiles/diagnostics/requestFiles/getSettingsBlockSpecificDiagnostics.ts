import {
    Block,
    isBlockDictionaryBlock,
    SettingsBlockKey,
    BooleanFieldValue,
    isDictionaryBlockSimpleField,
    DictionaryBlockSimpleField,
    DictionaryBlock,
} from "../../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinSettingsBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinSettingsBlockDiagnosticCodeEnum";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../shared/util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { getDiagnosticForInvalidDictionaryBlockSimpleFieldValue } from "../shared/util/getDiagnosticForInvalidDictionaryBlockSimpleFieldValue";

export function getSettingsBlockSpecificDiagnostics(
    settingsBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(settingsBlock)) {
        return [];
    }

    return runGenericChecksForAllFields(settingsBlock).concat(
        runChecksForSpecificFields(settingsBlock),
    );
}

function runGenericChecksForAllFields(settingsBlock: DictionaryBlock) {
    const mandatoryKeys = getMandatoryKeys();

    return [
        checkNoKeysAreMissingForDictionaryBlock(
            settingsBlock,
            mandatoryKeys,
            RelevantWithinSettingsBlockDiagnosticCode.KeysMissingInSettingsBlock,
        ),
    ].concat(
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            settingsBlock,
            mandatoryKeys,
            RelevantWithinSettingsBlockDiagnosticCode.UnknownKeysDefinedInSettingsBlock,
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            settingsBlock,
            mandatoryKeys,
            RelevantWithinSettingsBlockDiagnosticCode.DuplicateKeysDefinedInSettingsdBlock,
        ),
    );
}

function runChecksForSpecificFields(settingsBlock: DictionaryBlock) {
    // All fields in the settings block are simple dictionary fields.
    const validFields = settingsBlock.content.filter(
        isDictionaryBlockSimpleField,
    );

    // ToDo: Check if all fields are DIctionary block simple fields?

    const result = [
        {
            key: SettingsBlockKey.EncodeUrl,
            diagnosticCode:
                RelevantWithinSettingsBlockDiagnosticCode.EncodeUrlValueInvalid,
        },
        {
            key: SettingsBlockKey.FollowRedirects,
            diagnosticCode:
                RelevantWithinSettingsBlockDiagnosticCode.FollowRedirectsValueInvalid,
        },
    ].map(({ key, diagnosticCode }) =>
        checkIfBooleanFieldHasValidValue(validFields, key, diagnosticCode),
    );

    const fieldsForMaxRedirects = validFields.filter(
        ({ key }) => key == SettingsBlockKey.MaxRedirects,
    );
    if (fieldsForMaxRedirects.length == 1) {
        result.push(
            doesDictionaryBlockFieldHaveValidIntegerValue(
                fieldsForMaxRedirects[0],
                0,
            )
                ? undefined
                : getDiagnosticForInvalidDictionaryBlockSimpleFieldValue(
                      fieldsForMaxRedirects[0],
                      "Only non-negative integer values are allowed.",
                      RelevantWithinSettingsBlockDiagnosticCode.MaxRedirectsValueInvalid,
                  ),
        );
    }

    const fieldsForTimeout = validFields.filter(
        ({ key }) => key == SettingsBlockKey.Timeout,
    );
    const validNonNumericTimeoutValue = "inherit";
    if (fieldsForTimeout.length == 1) {
        result.push(
            doesDictionaryBlockFieldHaveValidIntegerValue(
                fieldsForTimeout[0],
                0,
            ) || fieldsForTimeout[0].value == validNonNumericTimeoutValue
                ? undefined
                : getDiagnosticForInvalidDictionaryBlockSimpleFieldValue(
                      fieldsForTimeout[0],
                      `Only the value '${validNonNumericTimeoutValue}' or a non-negative integer value is allowed.`,
                      RelevantWithinSettingsBlockDiagnosticCode.TimeoutValueInvalid,
                  ),
        );
    }

    return result;
}

function checkIfBooleanFieldHasValidValue(
    allSimpleFields: DictionaryBlockSimpleField[],
    key: SettingsBlockKey,
    diagnosticCodeInCaseOfFailedValidation: RelevantWithinSettingsBlockDiagnosticCode,
) {
    const fieldsWithKey = allSimpleFields.filter(({ key: k }) => k == key);

    return fieldsWithKey.length == 1
        ? checkValueForDictionaryBlockSimpleFieldIsValid(
              fieldsWithKey[0],
              Object.values(BooleanFieldValue),
              diagnosticCodeInCaseOfFailedValidation,
          )
        : undefined;
}

function getMandatoryKeys() {
    return Object.values(SettingsBlockKey);
}
