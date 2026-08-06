import { Range } from "../../..";

export enum YamlParsingSpecialErrorCode {
    FieldDoesNotExist = 1,
    UnknownFieldInMap = 2,
}

export interface YamlParsingError {
    message: string;
    range: Range;
    code?: YamlParsingSpecialErrorCode;
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
    type?: WithKeyAndValueRange<VariableType>;
    secret?: WithKeyAndValueRange<boolean>;
    disabled?: WithKeyAndValueRange<boolean>;
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
}
