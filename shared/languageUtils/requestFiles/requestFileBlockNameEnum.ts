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
    Http = "http",

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

    // OAuth2 additional params
    OAuth2AdditionalParams_AuthReq_Headers = "auth:oauth2:additional_params:auth_req:headers",
    OAuth2AdditionalParams_AuthReq_QueryParams = "auth:oauth2:additional_params:auth_req:queryparams",
    OAuth2AdditionalParams_AccessTokenReq_Headers = "auth:oauth2:additional_params:access_token_req:headers",
    OAuth2AdditionalParams_AccessTokenReq_Body = "auth:oauth2:additional_params:access_token_req:body",
    OAuth2AdditionalParams_AccessTokenReq_QueryParams = "auth:oauth2:additional_params:access_token_req:queryparams",
    OAuth2AdditionalParams_RefreshTokenReq_Headers = "auth:oauth2:additional_params:refresh_token_req:headers",
    OAuth2AdditionalParams_RefreshTokenReq_Body = "auth:oauth2:additional_params:refresh_token_req:body",
    OAuth2AdditionalParams_RefreshTokenReq_QueryParams = "auth:oauth2:additional_params:refresh_token_req:queryparams",

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
    Settings = "settings",
    Docs = "docs",
    Example = "example",
}
