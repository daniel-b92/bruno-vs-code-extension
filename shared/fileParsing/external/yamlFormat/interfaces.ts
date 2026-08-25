import { Range } from "../../..";
import { FileInfoType, VariableType } from "./constants/sharedConstants";
import {
    OptionalVariableFieldResult,
    ParsedAction,
    ParsedAuth,
    ParsedDocsWithType,
    ParsedRequestHeader,
    ParsedRequestVariable,
    ParsedScript,
    ParsedYamlMap,
    ParseYamlMapWithKeyAndValueRange,
    ParsedYamlMapWithValueRange,
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

export type ParsedFolderSettingsFile = ParsedYamlMap<{
    info?: ParsedInfoForFolderSettings;
    request?: ParseYamlMapWithKeyAndValueRange<{
        headers?: ParsedRequestHeader[];
        auth?: ParsedAuth;
        variables?: {
            enabled: ParsedRequestVariable[];
            disabled: ParsedRequestVariable[];
        };
        actions?: {
            enabled: ParsedAction[];
            disabled: ParsedAction[];
        };
        scripts?: ParsedScript[];
    }>;
    docs?: ParsedDocsWithType;
}>;

export type ParsedInfoForRequestFile = ParsedInfoForFolderSettings & {
    properties: {
        tags?: WithKeyAndValueRange<{ value: string; range: Range }[]>;
    };
};

export type ParsedInfoForFolderSettings = ParsedInfoForCollectionSettings & {
    properties: {
        type?: WithKeyAndValueRange<FileInfoType>;
        sequence?: WithKeyAndValueRange<number>;
    };
};

export type ParsedInfoForCollectionSettings = ParseYamlMapWithKeyAndValueRange<{
    name?: WithKeyAndValueRange<string>;
}>;

export type ParsedEnvironmentVariable = ParsedYamlMapWithValueRange<{
    name?: WithKeyAndValueRange<string>;
    value?:
        | WithKeyAndValueRange<string>
        | ({
              keyRange: Range;
          } & ParsedYamlMap<{
              type?: WithKeyAndValueRange<VariableType>;
              data?: WithKeyAndValueRange<string>;
          }>);
    description?: WithKeyAndValueRange<string>;
    type: OptionalVariableFieldResult<VariableType>;
    secret: OptionalVariableFieldResult<boolean>;
    disabled: OptionalVariableFieldResult<boolean>;
}>;

export interface WithKeyAndValueRange<T> {
    keyRange: Range;
    value: T;
    valueRange: Range;
}

export interface YamlMapMissingPropertyInfo {
    key: string;
    isMandatory: boolean;
    alwaysHasScalarValue: boolean;
}
