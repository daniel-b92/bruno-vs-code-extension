import { ParsingResult } from "../interfaces";
import { isParsingResultOnlyErrors } from "./isParsingResultOnlyErrors";

export function extractResultAndErrorsFromParsingResult<T>(
    parsingResult: ParsingResult<T>,
) {
    const { result, errors } = isParsingResultOnlyErrors(parsingResult)
        ? { result: undefined, errors: parsingResult }
        : { result: parsingResult.result, errors: parsingResult.errors };

    return { result, errors };
}
