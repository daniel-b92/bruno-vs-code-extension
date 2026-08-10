import { Range } from "../../..";
import {
    EnvironmentVariableProperty,
    FileInfoType,
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

export interface ParsedRequestFile {
    nonTypeSpecific: {
        info: ParsedInfo;
        runtime: WithKeyAndValueRange<{
            variables?: WithKeyAndValueRange<unknown[]>;
            scripts?: WithKeyAndValueRange<string[]>;
            assertions?: WithKeyAndValueRange<unknown[]>;
            auth?: WithKeyAndValueRange<unknown>;
        }>;
        docs?: WithKeyAndValueRange<string>;
    };
    typeSpecific: HttpTypeSpecificProperties;
}

export type ParsedInfo = WithKeyAndValueRange<{
    name: WithKeyAndValueRange<string>;
    type?: WithKeyAndValueRange<FileInfoType>;
    sequence?: WithKeyAndValueRange<number>;
    description?: WithKeyAndValueRange<string>;
    tags?: WithKeyAndValueRange<{ value: string; range: Range }[]>;
}>;

interface HttpTypeSpecificProperties {
    requestDetails?: WithKeyAndValueRange<unknown>;
    examples?: WithKeyAndValueRange<unknown[]>;
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

export enum VariableType {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
    String = "string",
}
