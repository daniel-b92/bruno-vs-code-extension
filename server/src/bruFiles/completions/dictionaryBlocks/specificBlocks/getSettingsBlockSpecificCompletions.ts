import { SettingsBlockKey, BooleanFieldValue } from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

export function getSettingsBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
) {
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
