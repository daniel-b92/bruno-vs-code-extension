import { ParsingResult } from "../../../internal/yamlFormat/interfaces";
import { isParsingResultOnlyErrors } from "../../../internal/yamlFormat/util/isParsingResultOnlyErrors";

export function extractResultAndErrorsFromParsingResult<T>(
    parsingResult: ParsingResult<T>,
) {
    const { result, errors } = isParsingResultOnlyErrors(parsingResult)
        ? { result: undefined, errors: parsingResult }
        : { result: parsingResult.result, errors: parsingResult.errors };

    return { result, errors };
}
