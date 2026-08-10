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

export enum TopLevelRequestOrFolderSettingsProperty {
    Info = "info",
    Runtime = "runtime",
    settings = "settings",

    // request-type specific
    Http = "http",
    Graphql = "graphql",
    Grpc = "grpc",
    Websocket = "websocket",

    docs = "docs",
    examples = "examples",
}

export enum FileInfoProperty {
    Name = "name",
    Type = "type",
    Seq = "seq",
    Tags = "tags",
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

type WithKeyAndKeyRange<T> = { value: T; key: string; keyRange: Range };
