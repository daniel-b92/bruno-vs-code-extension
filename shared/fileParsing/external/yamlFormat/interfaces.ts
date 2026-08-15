import { Range } from "../../..";
import {
    EnvironmentVariableProperty,
    FileInfoType,
    OptionalVariableFieldResult,
    ParsedAuth,
    ParsedDocsWithType,
    ParsedRequestHeader,
    ParsedRequestVariable,
    ParsedScript,
    VariableType,
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
    request?: {
        headers?: ParsedRequestHeader[];
        auth?: ParsedAuth;
        variables?: {
            enabled: ParsedRequestVariable[];
            disabled: ParsedRequestVariable[];
        };
        scripts?: WithKeyAndValueRange<ParsedScript[]>;
    };
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

export interface WithKeyAndValueRange<T> {
    keyRange: Range;
    value: T;
    valueRange: Range;
}
