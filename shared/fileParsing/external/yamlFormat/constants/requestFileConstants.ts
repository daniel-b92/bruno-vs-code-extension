import { FileInfoType } from "./sharedConstants";

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

export enum RequestFileGraphqlSectionProperty {
    method = "method",
    url = "url",
    headers = "headers",
    body = "body",
    auth = "auth",
}

export enum RequestFileGraphqlSectionBodyProperty {
    Query = "query",
    Variables = "variables",
}

export enum RequestFileWebsocketSectionProperty {
    url = "url",
    headers = "headers",
    message = "message",
    auth = "auth",
}

export enum RequestFileWebsocketMessageProperty {
    Title = "title",
    Selected = "selected",
    Message = "message",
}

export enum RequestFileWebsocketMessageBodyProperty {
    Type = "type",
    Data = "data",
}

export enum WebsocketMessageType {
    Json = "json",
    Xml = "xml",
    Text = "text",
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
    KeepAliveInterval = "keepAliveInterval",
}

const SETTINGS_FOR_NON_WEBSOCKET_REQUESTS = Object.values(
    RequestFileSettingsProperty,
).filter((prop) => prop != RequestFileSettingsProperty.KeepAliveInterval);

/**
 * The settings that are valid per request type.
 * For request types that are not listed (or if the type is unknown), no setting is excluded.
 */
export const SETTINGS_BY_REQUEST_TYPE: Partial<
    Record<FileInfoType, RequestFileSettingsProperty[]>
> = {
    [FileInfoType.Http]: SETTINGS_FOR_NON_WEBSOCKET_REQUESTS,
    [FileInfoType.Graphql]: SETTINGS_FOR_NON_WEBSOCKET_REQUESTS,
    [FileInfoType.Grpc]: SETTINGS_FOR_NON_WEBSOCKET_REQUESTS,
    [FileInfoType.Websocket]: [
        RequestFileSettingsProperty.Timeout,
        RequestFileSettingsProperty.KeepAliveInterval,
    ],
};

export enum RequestFileAppProperty {
    Enabled = "enabled",
    Code = "code",
}
