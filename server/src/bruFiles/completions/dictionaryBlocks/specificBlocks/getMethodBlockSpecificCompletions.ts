import {
    MethodBlockKey,
    MethodBlockBody,
    MethodBlockAuth,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

export function getMethodBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
) {
    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Body,
                ),
                choices: Object.values(MethodBlockBody),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    MethodBlockKey.Auth,
                ),
                choices: Object.values(MethodBlockAuth),
            },
        ],
        request,
    );
}
