import {
    ApiKeyAuthBlockKeys,
    ApiKeyAuthBlockPlacementValue,
    OAuth2ViaAuthorizationCodeBlockKeys,
    OAuth2BlockCredentialsPlacementValue,
    BooleanFieldValue,
    OAuth2BlockTokenPlacementValue,
    Block,
    AuthBlockName,
    getMandatoryKeysForNonOAuth2Block,
    AuthBlockNamesExcludingOAuth2,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";

export function getAuthBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    if (
        (Object.values(AuthBlockName) as string[]).includes(block.name) &&
        block.name != AuthBlockName.OAuth2Auth
    ) {
        // ToDo: Also provide completions for keys in OAuth2Auth blocks
        const completionsForKeys = getCompletionsForKeys(
            request,
            block,
            getMandatoryKeysForNonOAuth2Block(
                block.name as AuthBlockNamesExcludingOAuth2,
            ),
        );

        if (completionsForKeys) {
            return completionsForKeys;
        }
    }

    return getCompletionsForValues(request);
}

function getCompletionsForValues(request: LanguageFeatureBaseRequest) {
    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    ApiKeyAuthBlockKeys.Placement,
                ),
                choices: Object.values(ApiKeyAuthBlockPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKeys.CredentialsPlacement,
                ),
                choices: Object.values(OAuth2BlockCredentialsPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKeys.Pkce,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKeys.TokenPlacement,
                ),
                choices: Object.values(OAuth2BlockTokenPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKeys.AutoFetchToken,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKeys.AutoRefreshToken,
                ),
                choices: Object.values(BooleanFieldValue),
            },
        ],
        request,
    );
}
