export enum OAuth1SignatureMethod {
    HMAC_SHA1 = "HMAC-SHA1",
    HMAC_SHA256 = "HMAC-SHA256",
    HMAC_SHA512 = "HMAC-SHA512",
    RSA_SHA1 = "RSA-SHA1",
    RSA_SHA256 = "RSA-SHA256",
    RSA_SHA512 = "RSA-SHA512",
    PLAINTEXT = "PLAINTEXT",
}

export enum OAuth1Placement {
    Header = "header",
    Query = "query",
    Body = "body",
}
