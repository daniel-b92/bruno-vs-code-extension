import { Range } from "../../..";
import { EnvironmentVariableProperty } from "../../internal/yamlFormat/brunoSpecific/constants/environmentVariableConstants";
import {
    FileInfoType,
    VariableType,
} from "../../internal/yamlFormat/brunoSpecific/constants/sharedConstants";
import {
    OptionalVariableFieldResult,
    ParsedAction,
    ParsedAuth,
    ParsedDocsWithType,
    ParsedRequestHeader,
    ParsedRequestVariable,
    ParsedScript,
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
    info: OrAbsenceReason<ParsedInfoForFolderSettings>;
    request: OrAbsenceReason<{
        headers: OrAbsenceReason<ParsedRequestHeader[]>;
        auth: OrAbsenceReason<ParsedAuth>;
        variables: OrAbsenceReason<{
            enabled: ParsedRequestVariable[];
            disabled: ParsedRequestVariable[];
        }>;
        actions: OrAbsenceReason<{
            enabled: ParsedAction[];
            disabled: ParsedAction[];
        }>;
        scripts: OrAbsenceReason<ParsedScript[]>;
    }>;
    docs: OrAbsenceReason<ParsedDocsWithType>;
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

export type OrAbsenceReason<T> = T | { reason: ReasonForFieldAbsence };

export enum ReasonForFieldAbsence {
    Invalid = "invalid",
    Missing = "missing",
}
