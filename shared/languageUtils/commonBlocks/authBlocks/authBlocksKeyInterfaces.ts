export enum BasicAuthBlockKey {
    Username = "username",
    Password = "password",
}

export enum BearerAuthBlockKey {
    Token = "token",
}

export enum AwsV4AuthBlockKey {
    AccessKeyId = "accessKeyId",
    SecretAccessKey = "secretAccessKey",
    SessionToken = "sessionToken",
    Service = "service",
    Region = "region",
    ProfileName = "profileName",
}

export enum DigestAuthBlockKey {
    Username = "username",
    Password = "password",
}

export enum NtlmAuthBlockKey {
    Username = "username",
    Password = "password",
    Domain = "domain",
}

export const OAuth2AuthBlocksCommonKeys = {
    GrantType: "grant_type",
    CredentialsId: "credentials_id",
    TokenPlacement: "token_placement",
    TokenHeaderPrefix: "token_header_prefix",
    AutoFetchToken: "auto_fetch_token",
    Scope: "scope",
    ClientId: "client_id",
    TokenSource: "token_source",
} as const;

export const OAuth2ViaPasswordBlockKeys = {
    ...OAuth2AuthBlocksCommonKeys,
    AccessTokenUrl: "access_token_url",
    RefreshTokenUrl: "refresh_token_url",
    Username: "username",
    Password: "password",
    ClientSecret: "client_secret",
    AutoRefreshToken: "auto_refresh_token",
    CredentialsPlacement: "credentials_placement",
} as const;

export const OAuth2ViaAuthorizationCodeBlockKeys = {
    ...OAuth2AuthBlocksCommonKeys,
    CallbackUrl: "callback_url",
    Authorization_url: "authorization_url",
    AccessTokenUrl: "access_token_url",
    RefreshTokenUrl: "refresh_token_url",
    ClientSecret: "client_secret",
    State: "state",
    Pkce: "pkce",
    AutoRefreshToken: "auto_refresh_token",
    CredentialsPlacement: "credentials_placement",
} as const;

export const OAuth2ViaClientCredentialsBlockKeys = {
    ...OAuth2AuthBlocksCommonKeys,
    AccessTokenUrl: "access_token_url",
    RefreshTokenUrl: "refresh_token_url",
    ClientSecret: "client_secret",
    AutoRefreshToken: "auto_refresh_token",
    CredentialsPlacement: "credentials_placement",
} as const;

export const OAuth2ViaImplicitBlockKeys = {
    ...OAuth2AuthBlocksCommonKeys,
    CallbackUrl: "callback_url",
    Authorization_url: "authorization_url",
    State: "state",
} as const;

export enum WsseAuthBlockKey {
    Username = "username",
    Password = "password",
}

export enum ApiKeyAuthBlockKey {
    Key = "key",
    Value = "value",
    Placement = "placement",
}
