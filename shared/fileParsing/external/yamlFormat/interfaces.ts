import { Range } from "../../..";
import {
    FileInfoType,
    ParsedAuth,
    ParsedDocsWithType,
    ParsedRequestHeader,
    ParsedRequestVariable,
    ParsedScript,
    WithKeyAndValueRange,
} from "../../internal/yamlFormat/interfaces";

export enum YamlParsingErrorCode {
    ItemDoesNotExist = 1,
    UnknownFieldInMap = 2,
    Other = 99,
}

export interface YamlParsingError {
    message: string;
    range: Range;
    code: YamlParsingErrorCode;
}

export interface ParsedFolderSettingsFile {
    info: ParsedInfoForFolderSettings;
    request?: WithKeyAndValueRange<{
        headers?: WithKeyAndValueRange<ParsedRequestHeader[]>;
        auth?: WithKeyAndValueRange<ParsedAuth>;
        variables?: WithKeyAndValueRange<ParsedRequestVariable[]>;
        scripts?: WithKeyAndValueRange<ParsedScript[]>;
    }>;
    docs?: WithKeyAndValueRange<ParsedDocsWithType>;
}

export type ParsedInfoForRequestFile = ParsedInfoForFolderSettings & {
    value: {
        tags?: WithKeyAndValueRange<{ value: string; range: Range }[]>;
    };
};

export type ParsedInfoForFolderSettings = ParsedInfoForCollectionSettings & {
    value: {
        type?: WithKeyAndValueRange<FileInfoType>;
        sequence?: WithKeyAndValueRange<number>;
    };
};

export type ParsedInfoForCollectionSettings = WithKeyAndValueRange<{
    name: WithKeyAndValueRange<string>;
}>;
