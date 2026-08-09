import { Range } from "../../..";

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
    name: WithKeyAndValueRange<string>;
    value?:
        | WithKeyAndValueRange<string>
        | {
              type: WithKeyAndValueRange<VariableType>;
              data: WithKeyAndValueRange<string>;
          };
    description?: WithKeyAndValueRange<string>;
    type: WithKeyAndValueRange<VariableType> | { effectiveValue: VariableType };
    secret: WithKeyAndValueRange<boolean> | { effectiveValue: boolean };
    disabled: WithKeyAndValueRange<boolean> | { effectiveValue: boolean };
    missingProperties: EnvironmentVariableProperty[];
}

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

export enum EnvironmentVariableProperty {
    Name = "name",
    Value = "value",
    Description = "description",
    Disabled = "disabled",
    Secret = "secret",
    Type = "type",
}
