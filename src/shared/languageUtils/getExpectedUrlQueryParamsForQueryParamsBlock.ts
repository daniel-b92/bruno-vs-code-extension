import { DictionaryBlock } from "../fileParsing/external/interfaces";

export function getExpectedUrlQueryParamsForQueryParamsBlock(
    queryParamsBlock: DictionaryBlock
) {
    return new URLSearchParams(
        queryParamsBlock.content
            .map(({ key, value }) => `${key}=${value}`)
            .join("&")
    );
}
