import { YamlParsingError } from "../../../..";
import { ParsingResult } from "../interfaces";

export function isParsingResultOnlyErrors<T>(
    toCheck: ParsingResult<T>,
): toCheck is YamlParsingError[] {
    return Array.isArray(toCheck);
}
