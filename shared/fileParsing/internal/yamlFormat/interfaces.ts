import { Scalar, YAMLSeq } from "yaml";
import { Range, TextDocumentHelper } from "../../..";

export interface CommonParsingArgs {
    docHelper: TextDocumentHelper;
    fullDocumentRange: Range;
}

export interface ParsedMapItems {
    validScalars: {
        key: string;
        keyRange: Range;
        value: Scalar<unknown>;
    }[];
    validSequences: {
        key: string;
        keyRange: Range;
        value: YAMLSeq<unknown>;
    }[];
    invalidScalars: { key: string; valueRange: Range }[];
    invalidSequences: { key: string; valueRange: Range }[];
    unknownKeys: { key: string; keyRange: Range }[];
}
