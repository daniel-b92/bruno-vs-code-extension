import { DictionaryBlock } from "../testFileParsing/external/interfaces";

export function getExpectedMethodBlockUrlEndingForQueryParamsBlock(
    queryParamsBlock: DictionaryBlock
) {
    return queryParamsBlock.content
        .map(({ key, value }, index) =>
            index == 0 ? `?${key}=${value}` : `&${key}=${value}`
        )
        .join("");
}
