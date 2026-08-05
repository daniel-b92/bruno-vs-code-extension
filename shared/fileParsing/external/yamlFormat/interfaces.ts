import { Range } from "../../..";

export interface YamlParsingError {
    message: string;
    range: Range;
}

export interface ParsedEnvironmentVariable {
    name: string;
    value?: string | { type: VariableType; data: string };
    description?: string;
    type?: VariableType;
    secret: boolean;
    disabled: boolean;
}

export enum VariableType {
    Number = "number",
    Boolean = "boolean",
    Object = "object",
}
