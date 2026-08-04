import { Range } from "../../..";

export interface YamlParsingError {
    message: string;
    range: Range;
}
