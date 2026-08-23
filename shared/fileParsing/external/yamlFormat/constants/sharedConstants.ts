export enum RequestVariableProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
}

export enum RequestHeaderProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
}

export enum FileInfoProperty {
    Name = "name",
    Type = "type",
    Seq = "seq",
    Tags = "tags",
}

export enum ScriptMapProperty {
    Type = "type",
    Code = "code",
}

export enum FileInfoType {
    Folder = "folder",
    Http = "http",
    Graphql = "graphql",
    Grpc = "grpc",
    Websocket = "websocket",
}

export enum DocsType {
    TextMarkdown = "text/markdown",
}

export enum DocsProperty {
    Content = "content",
    Type = "type",
}

export enum VariableType {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
    String = "string",
}

export enum ScriptType {
    BeforeRequest = "before-request",
    AfterResponse = "after-response",
    Tests = "tests",
}
