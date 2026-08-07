import { Scalar, YAMLSeq } from "yaml";
import { Range, TextDocumentHelper } from "../../..";

export interface CommonParsingArgs {
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}

export interface ParsedMapItems {
    validScalars: {
        withStringValue: WithKeyAndKeyRange<Scalar<string>>[];
        withBooleanValue: WithKeyAndKeyRange<Scalar<boolean>>[];
        withUnknownValue: WithKeyAndKeyRange<Scalar<unknown>>[];
    };
    validSequences: WithKeyAndKeyRange<YAMLSeq<unknown>>[];
    invalidScalars: { key: string; valueRange: Range }[];
    invalidSequences: { key: string; valueRange: Range }[];
    unknownKeys: { key: string; keyRange: Range }[];
}

type WithKeyAndKeyRange<T> = { value: T; key: string; keyRange: Range };
