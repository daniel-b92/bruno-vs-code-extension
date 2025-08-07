import {
    Block,
    castBlockToDictionaryBlock,
    SettingsBlockKey,
    BooleanFieldValue,
} from "../../sharedred";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockFieldIsValid";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelevantWithinSettingsBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinSettingsBlockDiagnosticCodeEnum";

export function getSettingsBlockSpecificDiagnostics(
    settingsBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    const castedBlock = castBlockToDictionaryBlock(settingsBlock);

    if (!castedBlock) {
        return [];
    }

    const mandatoryKeys = Object.values(SettingsBlockKey);

    const result: (DiagnosticWithCode | undefined)[] = [];

    result.push(
        checkNoKeysAreMissingForDictionaryBlock(
            castedBlock,
            mandatoryKeys,
            RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock,
        ),
    );

    result.push(
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            castedBlock,
            mandatoryKeys,
            RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock,
        ),
    );

    result.push(
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            castedBlock,
            mandatoryKeys,
            RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
        ),
    );

    const encodeUrlFields = castedBlock.content.filter(
        ({ key }) => key == SettingsBlockKey.EncodeUrl,
    );

    if (encodeUrlFields.length == 1) {
        result.push(
            checkValueForDictionaryBlockFieldIsValid(
                encodeUrlFields[0],
                Object.values(BooleanFieldValue),
                RelevantWithinSettingsBlockDiagnosticCode.EncodeUrlValueInvalid,
            ),
        );
    }

    return result;
}
