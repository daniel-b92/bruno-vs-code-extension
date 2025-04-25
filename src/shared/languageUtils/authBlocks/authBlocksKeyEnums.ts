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

export enum OAuth2ViaPasswordBlockKey {
    GrantType = "grant_type",
    AccessTokenUrl = "access_token_url",
    RefreshTokenUrl = "refresh_token_url",
    Username = "username",
    Password = "password",
    ClientId = "client_id",
    ClientSecret = "client_secret",
    Scope = "scope",
    CredentialsPlacement = "credentials_placement",
    CredentialsId = "credentials_id",
    TokenPlacement = "token_placement",
    TokenHeaderPrefix = "token_header_prefix",
    AutoFetchToken = "auto_fetch_token",
    AutoRefreshToken = "auto_refresh_token",
}

export enum OAuth2ViaAuthorizationCodeBlockKey {
    GrantType = "grant_type",
    CallbackUrl = "callback_url",
    Authorization_url = "authorization_url",
    AccessTokenUrl = "access_token_url",
    RefreshTokenUrl = "refresh_token_url",
    ClientId = "client_id",
    ClientSecret = "client_secret",
    Scope = "scope",
    State = "state",
    Pkce = "pkce",
    CredentialsPlacement = "credentials_placement",
    CredentialsId = "credentials_id",
    TokenPlacement = "token_placement",
    TokenHeaderPrefix = "token_header_prefix",
    AutoFetchToken = "auto_fetch_token",
    AutoRefreshToken = "auto_refresh_token",
}

export enum OAuth2ViaClientCredentialsBlockKey {
    GrantType = "grant_type",
    AccessTokenUrl = "access_token_url",
    RefreshTokenUrl = "refresh_token_url",
    ClientId = "client_id",
    ClientSecret = "client_secret",
    Scope = "scope",
    CredentialsPlacement = "credentials_placement",
    CredentialsId = "credentials_id",
    TokenPlacement = "token_placement",
    TokenHeaderPrefix = "token_header_prefix",
    AutoFetchToken = "auto_fetch_token",
    AutoRefreshToken = "auto_refresh_token",
}

export enum WsseAuthBlockKey {
    Username = "username",
    Password = "password",
}

export enum ApiKeyAuthBlockKey {
    Key = "key",
    Value = "value",
    Placement = "placement",
}
