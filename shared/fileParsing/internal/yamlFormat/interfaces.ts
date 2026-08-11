import { Scalar, YAMLMap, YAMLSeq } from "yaml";
import { Range, TextDocumentHelper } from "../../..";

export enum EnvironmentVariableProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
    Secret = "secret",
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

export type WithKeyAndKeyRange<T> = { value: T; key: string; keyRange: Range };
