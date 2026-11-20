export enum BasicAuthProperty {
    Type = "type",
    Username = "username",
    Password = "password",
}

export enum BearerAuthProperty {
    Type = "type",
    Token = "token",
}

export const inheritAuthValue = "inherit" as const;

export const CommonAuthMapProperties = {
    type: "type",
} as const;

export enum AuthType {
    Awsv4 = "awsv4",
    Basic = "basic",
    Wsse = "wsse",
    Bearer = "bearer",
    Digest = "digest",
    Ntlm = "ntlm",
    Apikey = "apikey",
    Oauth1 = "oauth1",
    Oauth2 = "oauth2",
    AkamaiEdgegrid = "akamai-edgegrid",
}

export enum AwsV4AuthProperty {
    Type = "type",
    AccessKeyId = "accessKeyId",
    SecretAccessKey = "secretAccessKey",
    SessionToken = "sessionToken",
    Service = "service",
    Region = "region",
    ProfileName = "profileName",
}

export enum DigestAuthProperty {
    Type = "type",
    Username = "username",
    Password = "password",
}

export enum WsseAuthProperty {
    Type = "type",
    Username = "username",
    Password = "password",
}

export enum NtlmAuthProperty {
    Type = "type",
    Username = "username",
    Password = "password",
    Domain = "domain",
}

export enum ApiKeyAuthProperty {
    Type = "type",
    Key = "key",
    Value = "value",
    Placement = "placement",
}

export enum ApiKeyPlacement {
    Header = "header",
    Query = "query",
}

export enum AkamaiEdgegridAuthProperty {
    Type = "type",
    AccessToken = "accessToken",
    ClientToken = "clientToken",
    ClientSecret = "clientSecret",
    Nonce = "nonce",
    Timestamp = "timestamp",
    BaseUrl = "baseURL",
    HeadersToSign = "headersToSign",
    MaxBodySize = "maxBodySize",
}

export enum OAuth1AuthProperty {
    Type = "type",
    ConsumerKey = "consumerKey",
    ConsumerSecret = "consumerSecret",
    AccessToken = "accessToken",
    AccessTokenSecret = "accessTokenSecret",
    CallbackUrl = "callbackUrl",
    Verifier = "verifier",
    SignatureMethod = "signatureMethod",
    PrivateKey = "privateKey",
    Timestamp = "timestamp",
    Nonce = "nonce",
    Version = "version",
    Realm = "realm",
    Placement = "placement",
    IncludeBodyHash = "includeBodyHash",
}

export enum OAuth2AuthProperty {
    Type = "type",
    Flow = "flow",
    AuthorizationUrl = "authorizationUrl",
    AccessTokenUrl = "accessTokenUrl",
    RefreshTokenUrl = "refreshTokenUrl",
    CallbackUrl = "callbackUrl",
    Scope = "scope",
    State = "state",
    Credentials = "credentials",
    ResourceOwner = "resourceOwner",
    Pkce = "pkce",
    AdditionalParameters = "additionalParameters",
    TokenConfig = "tokenConfig",
    Settings = "settings",
}

export enum OAuth2Flow {
    AuthorizationCode = "authorization_code",
    ClientCredentials = "client_credentials",
    Implicit = "implicit",
    ResourceOwnerPasswordCredentials = "resource_owner_password_credentials",
}

export enum OAuth2CredentialsProperty {
    ClientId = "clientId",
    ClientSecret = "clientSecret",
    Placement = "placement",
}

export enum OAuth2CredentialsPlacement {
    BasicAuthHeader = "basic_auth_header",
    Body = "body",
}

export enum OAuth2ResourceOwnerProperty {
    Username = "username",
    Password = "password",
}

export enum OAuth2AdditionalParametersProperty {
    AuthorizationRequest = "authorizationRequest",
    AccessTokenRequest = "accessTokenRequest",
    RefreshTokenRequest = "refreshTokenRequest",
}

export enum OAuth2AdditionalParameterProperty {
    Name = "name",
    Value = "value",
    Placement = "placement",
}

export enum OAuth2AdditionalParameterPlacement {
    Header = "header",
    Query = "query",
    Body = "body",
}

export enum OAuth2TokenConfigProperty {
    Id = "id",
    Placement = "placement",
    Source = "source",
}

export enum OAuth2TokenPlacementProperty {
    Header = "header",
    Query = "query",
}

export enum OAuth2TokenSource {
    AccessToken = "access_token",
    IdToken = "id_token",
}

export enum OAuth2SettingsProperty {
    AutoFetchToken = "autoFetchToken",
    AutoRefreshToken = "autoRefreshToken",
}
