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

export enum ScriptMapProperty {
    Type = "type",
    Code = "code",
}

export enum ScriptType {
    BeforeRequest = "before-request",
    AfterResponse = "after-response",
    Tests = "tests",
}

export enum AssertionMapProperty {
    Expression = "expression",
    Operator = "operator",
    Value = "value",
    Description = "description",
}

export enum AssertionOperator {
    Equals = "eq",
    NotEquals = "neq",
    GreaterThan = "gt",
    GreaterThanOrEqual = "gte",
    LessThan = "lt",
    LessThanOrEqual = "lte",
    In = "in",
    NotIn = "notIn",
    Contains = "contains",
    Notcontains = "notcontains",
    Length = "length",
    Matches = "matches",
    NotMatches = "notMatches",
    StartsWith = "startsWith",
    EndsWith = "endsWith",
    Between = "between",
    IsEmpty = "isEmpty",
    IsNotEmpty = "isNotEmpty",
    IsNull = "isNull",
    IsUndefined = "isUndefined",
    IsDefined = "isDefined",
    IsTruthy = "isTruthy",
    IsFalsy = "isFalsy",
    IsJson = "isJson",
    IsNumber = "isNumber",
    IsString = "isString",
    IsBoolean = "isBoolean",
    IsArray = "isArray",
}
