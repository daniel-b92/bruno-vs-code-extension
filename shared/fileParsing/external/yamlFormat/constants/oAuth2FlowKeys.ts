import {
    OAuth2AuthProperty,
    OAuth2CredentialsProperty,
    OAuth2Flow,
    OAuth2ResourceOwnerProperty,
} from "./authConstants";

export interface OAuth2FlowKey {
    key: OAuth2AuthProperty;
    /** For map values: the keys of the nested map. */
    childKeys?: (OAuth2CredentialsProperty | OAuth2ResourceOwnerProperty)[];
}

/**
 * Returns the keys of an `oauth2` auth that Bruno uses for the given flow (in the order of Bruno's UI).
 * Optional keys that are relevant for all flows (e.g. `pkce` or `settings`) are not included.
 */
export function getKeysForOAuth2Flow(flow: OAuth2Flow): OAuth2FlowKey[] {
    const credentialsWithSecret: OAuth2FlowKey = {
        key: OAuth2AuthProperty.Credentials,
        childKeys: [
            OAuth2CredentialsProperty.ClientId,
            OAuth2CredentialsProperty.ClientSecret,
        ],
    };

    switch (flow) {
        case OAuth2Flow.AuthorizationCode:
            return [
                { key: OAuth2AuthProperty.AuthorizationUrl },
                { key: OAuth2AuthProperty.AccessTokenUrl },
                { key: OAuth2AuthProperty.CallbackUrl },
                credentialsWithSecret,
                { key: OAuth2AuthProperty.Scope },
                { key: OAuth2AuthProperty.State },
            ];
        case OAuth2Flow.ClientCredentials:
            return [
                { key: OAuth2AuthProperty.AccessTokenUrl },
                credentialsWithSecret,
                { key: OAuth2AuthProperty.Scope },
            ];
        case OAuth2Flow.Implicit:
            return [
                { key: OAuth2AuthProperty.AuthorizationUrl },
                { key: OAuth2AuthProperty.CallbackUrl },
                {
                    key: OAuth2AuthProperty.Credentials,
                    childKeys: [OAuth2CredentialsProperty.ClientId],
                },
                { key: OAuth2AuthProperty.Scope },
                { key: OAuth2AuthProperty.State },
            ];
        case OAuth2Flow.ResourceOwnerPasswordCredentials:
            return [
                { key: OAuth2AuthProperty.AccessTokenUrl },
                {
                    key: OAuth2AuthProperty.ResourceOwner,
                    childKeys: [
                        OAuth2ResourceOwnerProperty.Username,
                        OAuth2ResourceOwnerProperty.Password,
                    ],
                },
                credentialsWithSecret,
                { key: OAuth2AuthProperty.Scope },
            ];
    }
}
