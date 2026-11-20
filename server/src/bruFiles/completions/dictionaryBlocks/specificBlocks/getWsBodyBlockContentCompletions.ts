import {
    Block,
    BooleanFieldValue,
    getMandatoryKeysForWsBodyBlock,
    getOptionalKeysForWsBodyBlock,
    WsBodyBlockKey,
    WsBodyBlockMessageType,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

export function getWsBodyBlockContentCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    const completionsForKeys = getCompletionsForKeys(request, block, {
        mandatory: getMandatoryKeysForWsBodyBlock(),
        optional: getOptionalKeysForWsBodyBlock(),
    });

    if (completionsForKeys) {
        return completionsForKeys;
    }

    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    WsBodyBlockKey.Type,
                ),
                choices: Object.values(WsBodyBlockMessageType),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    WsBodyBlockKey.Selected,
                ),
                choices: Object.values(BooleanFieldValue),
            },
        ],
        request,
    );
}
