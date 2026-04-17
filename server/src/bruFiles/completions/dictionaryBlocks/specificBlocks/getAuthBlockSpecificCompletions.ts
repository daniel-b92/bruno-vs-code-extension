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
    isAuthBlock,
    isDictionaryBlockSimpleField,
    OAuth2AuthBlocksCommonKeys,
    OAuth2GrantType,
    getMandatoryKeysForOAuth2Block,
    OAuth2BlockTokenSourceValue,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../../../shared";
import { getFixedCompletionItems } from "../generic/getFixedCompletionItems";
import { getLinePatternForDictionaryField } from "../generic/getLinePatternForDictionaryField";
import { getCompletionsForKeys } from "../generic/getCompletionsForKeys";

export function getAuthBlockSpecificCompletions(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    if (isAuthBlock(block.name)) {
        const completionsForKeys =
            block.name == AuthBlockName.OAuth2Auth
                ? getCompletionsForKeysForOAuth2AuthBlock(request, block)
                : getCompletionsForKeys(request, block, {
                      mandatory: getMandatoryKeysForNonOAuth2Block(
                          block.name as AuthBlockNamesExcludingOAuth2,
                      ),
                  });

        if (completionsForKeys) {
            return completionsForKeys;
        }
    }

    return getCompletionsForValues(request);
}

function getCompletionsForKeysForOAuth2AuthBlock(
    request: LanguageFeatureBaseRequest,
    block: Block,
) {
    const grantTypeFieldsInOtherLines = !Array.isArray(block.content)
        ? []
        : block.content
              .filter((field) => isDictionaryBlockSimpleField(field))
              .filter(
                  ({ key, keyRange: { start } }) =>
                      start.line != request.position.line &&
                      key == OAuth2AuthBlocksCommonKeys.GrantType,
              );

    const grantType =
        grantTypeFieldsInOtherLines.length != 1
            ? undefined
            : Object.values(OAuth2GrantType).find(
                  (valid) => valid == grantTypeFieldsInOtherLines[0].value,
              );

    const completionsForKeys = grantType
        ? getCompletionsForKeys(request, block, {
              mandatory: getMandatoryKeysForOAuth2Block(grantType),
          })
        : undefined;

    if (completionsForKeys) {
        return completionsForKeys;
    }
}

function getCompletionsForValues(request: LanguageFeatureBaseRequest) {
    return getFixedCompletionItems(
        [
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2ViaAuthorizationCodeBlockKeys.GrantType,
                ),
                choices: Object.values(OAuth2GrantType),
            },
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
                    OAuth2AuthBlocksCommonKeys.TokenPlacement,
                ),
                choices: Object.values(OAuth2BlockTokenPlacementValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2AuthBlocksCommonKeys.TokenSource,
                ),
                choices: Object.values(OAuth2BlockTokenSourceValue),
            },
            {
                linePattern: getLinePatternForDictionaryField(
                    OAuth2AuthBlocksCommonKeys.AutoFetchToken,
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
