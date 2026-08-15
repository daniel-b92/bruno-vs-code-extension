import { YamlParsingError } from "../../../external/yamlFormat/interfaces";
import { ParsingResult } from "../interfaces";
import { isParsingResultOnlyErrors } from "./isParsingResultOnlyErrors";

export function extractErrorsFromParsingResult<T>(
    parsingResult: ParsingResult<T>,
): { result?: T; errors: YamlParsingError[] } {
    const { result, errors } = isParsingResultOnlyErrors(parsingResult)
        ? { result: undefined, errors: parsingResult }
        : { ...parsingResult };

    return { result, errors };
}
