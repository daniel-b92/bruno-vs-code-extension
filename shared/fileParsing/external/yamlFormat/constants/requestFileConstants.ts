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
    Code = "enabled",
}
