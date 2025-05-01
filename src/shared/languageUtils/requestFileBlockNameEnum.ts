export enum RequestFileBlockName {
    // Meta
    Meta = "meta",

    // methods
    Get = "get",
    Post = "post",
    Put = "put",
    Delete = "delete",
    Options = "options",
    Patch = "patch",
    Head = "head",

    // params
    QueryParams = "params:query",
    PathParams = "params:path",

    // headers
    Headers = "headers",

    // Auth
    BasicAuth = "auth:basic",
    BearerAuth = "auth:bearer",
    AwsSigV4Auth = "auth:awsv4",
    DigestAuth = "auth:digest",
    NtlmAuth = "auth:ntlm",
    OAuth2Auth = "auth:oauth2",
    WsseAuth = "auth:wsse",
    ApiKeyAuth = "auth:apikey",
    

    // Body
    JsonBody = "body:json",
    XmlBody = "body:xml",
    TextBody = "body:text",
    MultipartFormBody = "body:multipart-form",
    FormUrlEncodedBody = "body:form-urlencoded",
    SparqlBody = "body:sparql",
    FileOrBinaryBody = "body:file",
    GraphQlBody = "body:graphql",
    GraphQlBodyVars = "body:graphql:vars",

    // Vars
    PreRequestVars = "vars:pre-request",
    PostResponseVars = "vars:post-response",

    // Assertions and tests
    Assertions = "assert",
    Tests = "tests",

    // Scripts
    PreRequestScript = "script:pre-request",
    PostResponseScript = "script:post-response",

    // Other
    Docs = "docs",
}
