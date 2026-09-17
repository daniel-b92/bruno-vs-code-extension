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

export enum RequestFileSettingsProperty {
    EncodeUrl = "encodeUrl",
    Timeout = "timeout",
    FollowRedirects = "followRedirects",
    MaxRedirects = "maxRedirects",
    ForwardAuthorizationHeader = "forwardAuthorizationHeader",
}

export enum RequestFileRuntimeProperty {
    Variables = "variables",
    Scripts = "scripts",
    Assertions = "assertions",
    Actions = "actions",
}

export enum RequestFileAppProperty {
    Enabled = "enabled",
    Code = "enabled",
}
