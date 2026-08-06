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
    name: WithRange<string>;
    value?:
        | WithRange<string>
        | {
              type: WithRange<VariableType>;
              data: WithRange<string>;
          };
    description?: WithRange<string>;
    type?: WithRange<VariableType>;
    secret?: WithRange<boolean>;
    disabled?: WithRange<boolean>;
}

export interface WithRange<T> {
    value: T;
    range: Range;
}

export enum VariableType {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
}
