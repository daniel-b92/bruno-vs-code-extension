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
}
