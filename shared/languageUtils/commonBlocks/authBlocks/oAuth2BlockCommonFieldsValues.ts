export const OAuth2BlockCredentialsPlacementValue = {
    Body: "body",
    BasicAuthHeader: "basic_auth_header",
} as const;

export const OAuth2BlockTokenPlacementValue = {
    Header: "header",
    Url: "url",
} as const;

export const OAuth2BlockTokenSourceValue = {
    AccessToken: "access_token",
    IdToken: "id_token",
} as const;
