import { Block, AuthModeBlockKey, MethodBlockAuthValues } from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";

export function getAuthModeBlockContentCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    const completionsForKeys = getCompletionsForKeys(request, block, {
        mandatory: [AuthModeBlockKey.Mode],
    });

    if (completionsForKeys) {
        return completionsForKeys;
    }

    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    AuthModeBlockKey.Mode,
                ),
                // The same values are valid as for the auth field in method blocks.
                choices: Object.values(MethodBlockAuthValues),
            },
        ],
        request,
    );
}
