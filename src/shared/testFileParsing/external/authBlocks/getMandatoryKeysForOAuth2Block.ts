import {
    OAuth2ViaAuthorizationCodeBlockKey,
    OAuth2ViaClientCredentialsBlockKey,
    OAuth2ViaPasswordBlockKey,
} from "../../../languageUtils/authBlocks/authBlocksKeyEnums";
import { OAuth2GrantType } from "../../../languageUtils/authBlocks/oAuth2BlockValuesEnums";

export function getMandatoryKeysForOAuth2Block(
    grantType: OAuth2GrantType
): string[] {
    if (grantType == OAuth2GrantType.AuthorizationCode) {
        return Object.values(OAuth2ViaAuthorizationCodeBlockKey);
    } else if (grantType == OAuth2GrantType.ClientCredentials) {
        return Object.values(OAuth2ViaClientCredentialsBlockKey);
    } else {
        return Object.values(OAuth2ViaPasswordBlockKey);
    }
}
