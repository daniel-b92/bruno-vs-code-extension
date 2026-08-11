import { Scalar, YAMLMap, YAMLSeq } from "yaml";
import { Range, TextDocumentHelper } from "../../..";

export interface CommonParsingArgs {
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}

export interface ParsedMapItems {
    validScalars: {
        withStringValue: WithKeyAndKeyRange<Scalar<string>>[];
        withBooleanValue: WithKeyAndKeyRange<Scalar<boolean>>[];
        withNumericValue: WithKeyAndKeyRange<Scalar<number>>[];
        withUnknownValue: WithKeyAndKeyRange<Scalar<unknown>>[];
    };
    validSequences: WithKeyAndKeyRange<YAMLSeq<unknown>>[];
    validMaps: WithKeyAndKeyRange<YAMLMap<unknown, unknown>>[];
    missingKeys: string[];
    unknownKeys: { key: string; keyRange: Range }[];
}

export interface ParsedEnvironmentVariable {
    range: Range;
    missingProperties: EnvironmentVariableProperty[];
    fields: {
        name: WithKeyAndValueRange<string>;
        value?:
            | WithKeyAndValueRange<string>
            | {
                  keyRange: Range;
                  type: WithKeyAndValueRange<VariableType>;
                  data: WithKeyAndValueRange<string>;
              };
        description?: WithKeyAndValueRange<string>;
        type: OptionalVariableFieldResult<VariableType>;
        secret: OptionalVariableFieldResult<boolean>;
        disabled: OptionalVariableFieldResult<boolean>;
    };
}

export interface ParsedRequestVariable {
    missingProperties: RequestVariableProperty[];
    fields: WithKeyAndValueRange<{
        name: WithKeyAndValueRange<string>;
        value?:
            | WithKeyAndValueRange<string>
            | {
                  keyRange: Range;
                  type: WithKeyAndValueRange<VariableType>;
                  data: WithKeyAndValueRange<string>;
              };
        description?: WithKeyAndValueRange<string>;
        type: OptionalVariableFieldResult<VariableType>;
        disabled: OptionalVariableFieldResult<boolean>;
    }>;
}

export interface ParsedRequestHeader {
    name: WithKeyAndValueRange<string>;
    value: WithKeyAndValueRange<string>;
}

export interface ParsedScript {
    type: WithKeyAndValueRange<ScriptType>;
    code: WithKeyAndValueRange<string>;
}

export type ParsedAuth = ParsedBasicAuth | ParsedBearerAuth;

export interface ParsedBasicAuth {
    type: WithKeyAndValueRange<AuthType.Basic>;
    username: WithKeyAndValueRange<string>;
    password: WithKeyAndValueRange<string>;
}

export interface ParsedBearerAuth {
    type: WithKeyAndValueRange<AuthType.Bearer>;
    token: WithKeyAndValueRange<string>;
}

export enum EnvironmentVariableProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
    Secret = "secret",
    Type = "type",
}

export enum RequestVariableProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
    Type = "type",
}

export enum TopLevelRequestFileProperty {
    Info = "info",
    Runtime = "runtime",
    settings = "settings",

    // request-type specific
    Http = "http",
    Graphql = "graphql",
    Grpc = "grpc",
    Websocket = "websocket",

    Docs = "docs",
    Examples = "examples",
}

export enum TopLevelFolderSettingsProperty {
    Info = "info",
    Request = "request",
    Docs = "docs",
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

export enum VariableType {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
    String = "string",
}

export enum AuthType {
    Awsv4 = "awsv4",
    Basic = "basic",
    Wsse = "wsse",
    Bearer = "bearer",
    Digest = "digest",
    Ntlm = "ntlm",
    Aikey = "apikey",
    Oauth1 = "oauth1",
    Oauth2 = "oauth2",
}

export enum ScriptType {
    BeforeRequest = "before-request",
    AfterResponse = "after-response",
    Tests = "tests",
}

export type OptionalVariableFieldResult<T> = {
    effectiveValue: T;
    field?: WithKeyAndValueRange<T>;
};

export interface WithKeyAndValueRange<T> {
    keyRange: Range;
    value: T;
    valueRange: Range;
}

export type WithKeyAndKeyRange<T> = { value: T; key: string; keyRange: Range };
