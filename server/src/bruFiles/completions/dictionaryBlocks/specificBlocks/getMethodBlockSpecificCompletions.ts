import {
    MethodBlockKey,
    MethodBlockBodies,
    MethodBlockAuthValues,
    Block,
    getMandatoryKeysForMethodBlock,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";

export function getMethodBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    const completionsForKeys = getCompletionsForKeys(request, block, {
        mandatory: getMandatoryKeysForMethodBlock(block.name),
    });

    if (completionsForKeys) {
        return completionsForKeys;
    }

    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Body,
                ),
                choices: Object.values(MethodBlockBodies),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Auth,
                ),
                choices: Object.values(MethodBlockAuthValues),
            },
        ],
        request,
    );
}
