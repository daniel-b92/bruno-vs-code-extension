export enum TopLevelRequestFileProperty {
    Info = "info",
    Runtime = "runtime",
    Settings = "settings",

    // request-type specific
    Http = "http",
    Graphql = "graphql",
    Grpc = "grpc",
    Websocket = "websocket",

    Docs = "docs",
    Examples = "examples",
    App = "app",
}

export enum RequestFileHttpSectionProperty {
    method = "method",
    url = "url",
    headers = "headers",
    params = "params",
    body = "body",
    auth = "auth",
}

export enum RequestFileHttpSectionParamProperty {
    Name = "name",
    Value = "value",
    Type = "type",
    Description = "description",
    Disabled = "disabled",
}

export enum RequestFileHttpSectionBodyProperty {
    Type = "type",
    Data = "data",
}

export enum HttpBodyType {
    None = "none",
    Json = "json",
    Xml = "xml",
    Text = "text",
    MultipartForm = "multipart-form",
    FormUrlEncoded = "form-urlencoded",
    Sparql = "sparql",
    File = "file",
    Graphql = "graphql",
}

export enum HttpParamType {
    Query = "query",
    Path = "path",
}

export enum RequestFileRuntimeProperty {
    Variables = "variables",
    Scripts = "scripts",
    Assertions = "assertions",
    Actions = "actions",
}

export enum RequestFileSettingsProperty {
    EncodeUrl = "encodeUrl",
    Timeout = "timeout",
    FollowRedirects = "followRedirects",
    MaxRedirects = "maxRedirects",
    ForwardAuthorizationHeader = "forwardAuthorizationHeader",
}

export enum RequestFileAppProperty {
    Enabled = "enabled",
    Code = "code",
}
