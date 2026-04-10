import {
    OAuth2ViaAuthorizationCodeBlockKeys,
    OAuth2ViaClientCredentialsBlockKeys,
    OAuth2ViaImplicitBlockKeys,
    OAuth2ViaPasswordBlockKeys,
} from "./authBlocksKeyInterfaces";
import { OAuth2GrantType } from "./oAuth2GrantTypeEnum";

export function getMandatoryKeysForOAuth2Block(
    grantType: OAuth2GrantType,
): string[] {
    switch (grantType) {
        case OAuth2GrantType.AuthorizationCode:
            return Object.values(OAuth2ViaAuthorizationCodeBlockKeys);
        case OAuth2GrantType.ClientCredentials:
            return Object.values(OAuth2ViaClientCredentialsBlockKeys);
        case OAuth2GrantType.PasswordCredentials:
            return Object.values(OAuth2ViaPasswordBlockKeys);
        case OAuth2GrantType.Implicit:
            return Object.values(OAuth2ViaImplicitBlockKeys);
    }
}
