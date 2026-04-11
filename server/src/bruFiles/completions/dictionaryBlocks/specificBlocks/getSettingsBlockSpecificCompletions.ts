import {
    SettingsBlockKey,
    BooleanFieldValue,
    Block,
    getMandatoryKeysForSettingsBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";

export function getSettingsBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    const completionsForKeys = getCompletionsForKeys(request, block, {
        mandatory: getMandatoryKeysForSettingsBlock(),
    });

    if (completionsForKeys) {
        return completionsForKeys;
    }

    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    SettingsBlockKey.EncodeUrl,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    SettingsBlockKey.FollowRedirects,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    SettingsBlockKey.Timeout,
                ),
                choices: ["inherit"],
            },
        ],
        request,
    );
}
