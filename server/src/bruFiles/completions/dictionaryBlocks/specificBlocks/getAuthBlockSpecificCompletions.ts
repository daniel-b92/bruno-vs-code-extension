import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    OAuth2ViaAuthorizationCodeBlockKey,
    OAuth2BlockCredentialsPlacementValue,
    BooleanFieldValue,
    OAuth2BlockTokenPlacementValue,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";

export function getAuthBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
) {
    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    ApiKeyAuthBlockKey.Placement,
                ),
                choices: Object.values(ApiKeyAuthBlockPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.CredentialsPlacement,
                ),
                choices: Object.values(OAuth2BlockCredentialsPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.Pkce,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.TokenPlacement,
                ),
                choices: Object.values(OAuth2BlockTokenPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.AutoFetchToken,
                ),
                choices: Object.values(BooleanFieldValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKey.AutoRefreshToken,
                ),
                choices: Object.values(BooleanFieldValue),
            },
        ],
        request,
    );
}
