import { YAMLMap, YAMLSeq } from "yaml";
import { Range, TextDocumentHelper, YamlParsingError } from "../../..";

export interface CommonParsingArgs {
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}

export interface ParsedMapItems {
    validScalars: {
        withStringValue: WithKeyKeyRangeAndValueRange<string>[];
        withBooleanValue: WithKeyKeyRangeAndValueRange<boolean>[];
        withNumericValue: WithKeyKeyRangeAndValueRange<number>[];
        withUnknownValue: WithKeyKeyRangeAndValueRange<unknown>[];
    };
    validSequences: WithKeyAndKeyRange<YAMLSeq>[];
    validMaps: WithKeyAndKeyRange<YAMLMap>[];
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
    description?: WithKeyAndValueRange<string>;
    disabled: OptionalVariableFieldResult<boolean>;
}

export interface ParsedScript {
    type: WithKeyAndValueRange<ScriptType>;
    code: WithKeyAndValueRange<string>;
}

export interface ParsedDocsWithType {
    type: WithKeyAndValueRange<DocsType>;
    content: WithKeyAndValueRange<string>;
}

export type ParsedAuth = ParsedInheritAuth | ParsedBasicAuth | ParsedBearerAuth;

export interface ParsedBasicAuth {
    type: WithKeyAndValueRange<AuthType.Basic>;
    username?: WithKeyAndValueRange<string>;
    password?: WithKeyAndValueRange<string>;
}

export interface ParsedBearerAuth {
    type: WithKeyAndValueRange<AuthType.Bearer>;
    token?: WithKeyAndValueRange<string>;
}

export interface ParsedInheritAuth {
    valueRange: Range;
}

export enum EnvironmentVariableProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
    Secret = "secret",
    Type = "type",
}

export enum FolderSettingsRequestSectionProperty {
    Headers = "headers",
    Auth = "auth",
    Variables = "variables",
    Actions = "actions",
    Scripts = "scripts",
}

export enum RequestVariableProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
    Type = "type",
}

export enum RequestHeaderProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
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

export enum BasicAuthProperty {
    Type = "type",
    Username = "username",
    Password = "password",
}

export enum BearerAuthProperty {
    Type = "type",
    Token = "token",
}

export const inheritAuthValue = "inherit" as const;

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

export enum VariableType {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
    String = "string",
}

export const CommonAuthMapProperties = {
    type: "type",
} as const;

export enum AuthType {
    Awsv4 = "awsv4",
    Basic = "basic",
    Wsse = "wsse",
    Bearer = "bearer",
    Digest = "digest",
    Ntlm = "ntlm",
    Apikey = "apikey",
    Oauth1 = "oauth1",
    Oauth2 = "oauth2",
}

export enum ScriptType {
    BeforeRequest = "before-request",
    AfterResponse = "after-response",
    Tests = "tests",
}

export type ParsingResult<T> =
    | YamlParsingError[]
    | {
          result: T;
          errors: YamlParsingError[];
      };

export type OptionalVariableFieldResult<T> = {
    effectiveValue: T;
    field?: WithKeyAndValueRange<T>;
};

export type WithKeyKeyRangeAndValueRange<T> = WithKeyAndValueRange<T> & {
    key: string;
};

export interface WithKeyAndValueRange<T> {
    keyRange: Range;
    value: T;
    valueRange: Range;
}

export type WithKeyAndKeyRange<T> = { value: T; key: string; keyRange: Range };
