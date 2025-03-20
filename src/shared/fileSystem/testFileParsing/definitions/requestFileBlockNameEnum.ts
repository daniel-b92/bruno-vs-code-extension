export enum RequestFileBlockName {
    // Meta
    Meta = "meta",

    // HTTP methods
    Get = "get",
    Post = "post",
    Put = "put",
    Delete = "delete",
    Options = "options",
    Patch = "patch",
    Head = "head",

    // Auth
    BasicAuth = "auth:basic",
    BearerAuth = "auth:bearer",

    // Body
    JsonBody = "body:json",
    XmlBody = "body:xml",

    // Scripts
    PreRequestScript = "script:pre-request",
    PostResponseScript = "script:post-response",

    // Other
    Tests = "tests",
    Docs = "docs",
}
