import {
    Block,
    isBlockDictionaryBlock,
    SettingsBlockKey,
    BooleanFieldValue,
    isDictionaryBlockSimpleField,
} from "../../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelevantWithinSettingsBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinSettingsBlockDiagnosticCodeEnum";

export function getSettingsBlockSpecificDiagnostics(
    settingsBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(settingsBlock)) {
        return [];
    }

    const mandatoryKeys = Object.values(SettingsBlockKey);

    const result: (DiagnosticWithCode | undefined)[] = [];

    result.push(
        checkNoKeysAreMissingForDictionaryBlock(
            settingsBlock,
            mandatoryKeys,
            RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock,
        ),
    );

    result.push(
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            settingsBlock,
            mandatoryKeys,
            RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock,
        ),
    );

    result.push(
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            settingsBlock,
            mandatoryKeys,
            RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
        ),
    );

    const encodeUrlFields = settingsBlock.content.filter(
        ({ key }) => key == SettingsBlockKey.EncodeUrl,
    );

    if (
        encodeUrlFields.length == 1 &&
        isDictionaryBlockSimpleField(encodeUrlFields[0])
    ) {
        result.push(
            checkValueForDictionaryBlockSimpleFieldIsValid(
                encodeUrlFields[0],
                Object.values(BooleanFieldValue),
                RelevantWithinSettingsBlockDiagnosticCode.EncodeUrlValueInvalid,
            ),
        );
    }

    return result;
}
