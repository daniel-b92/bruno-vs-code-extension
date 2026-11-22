import {
    OAuth2AdditionalParametersProperty,
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
 * Optional keys that are relevant for all flows (e.g. `tokenConfig` or `settings`) are not included.
 * `pkce` is also not included, because it is only relevant for the `authorization_code` flow.
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

export interface OAuth2IgnoredKey {
    key: OAuth2AuthProperty;
    /** For keys within a map value: the key within the map, e.g. `clientSecret` for `credentials`. */
    childKey?: OAuth2CredentialsProperty | OAuth2AdditionalParametersProperty;
}

/**
 * Returns the keys of an `oauth2` auth that Bruno ignores for the given flow.
 * Bruno only reads the keys belonging to the selected flow and drops all others the next time it saves the file.
 * Keys that are read for all flows (e.g. `tokenConfig` or `settings`) are never included.
 */
export function getIgnoredKeysForOAuth2Flow(
    flow: OAuth2Flow,
): OAuth2IgnoredKey[] {
    const authorizationFlowKeys: OAuth2IgnoredKey[] = [
        { key: OAuth2AuthProperty.AuthorizationUrl },
        { key: OAuth2AuthProperty.CallbackUrl },
        { key: OAuth2AuthProperty.State },
        { key: OAuth2AuthProperty.Pkce },
        {
            key: OAuth2AuthProperty.AdditionalParameters,
            childKey: OAuth2AdditionalParametersProperty.AuthorizationRequest,
        },
    ];
    const resourceOwner: OAuth2IgnoredKey = {
        key: OAuth2AuthProperty.ResourceOwner,
    };

    switch (flow) {
        case OAuth2Flow.AuthorizationCode:
            return [resourceOwner];
        case OAuth2Flow.ClientCredentials:
            return [...authorizationFlowKeys, resourceOwner];
        case OAuth2Flow.ResourceOwnerPasswordCredentials:
            return authorizationFlowKeys;
        case OAuth2Flow.Implicit:
            return [
                { key: OAuth2AuthProperty.AccessTokenUrl },
                { key: OAuth2AuthProperty.RefreshTokenUrl },
                {
                    key: OAuth2AuthProperty.Credentials,
                    childKey: OAuth2CredentialsProperty.ClientSecret,
                },
                {
                    key: OAuth2AuthProperty.Credentials,
                    childKey: OAuth2CredentialsProperty.Placement,
                },
                resourceOwner,
                { key: OAuth2AuthProperty.Pkce },
                {
                    key: OAuth2AuthProperty.AdditionalParameters,
                    childKey:
                        OAuth2AdditionalParametersProperty.AccessTokenRequest,
                },
                {
                    key: OAuth2AuthProperty.AdditionalParameters,
                    childKey:
                        OAuth2AdditionalParametersProperty.RefreshTokenRequest,
                },
            ];
    }
}
