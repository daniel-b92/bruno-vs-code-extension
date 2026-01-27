import { DictionaryBlockSimpleField } from "../..";

export function getExpectedUrlQueryParamsForQueryParamsBlock(
    queryParamsBlockFields: DictionaryBlockSimpleField[],
) {
    return new URLSearchParams(
        queryParamsBlockFields
            .map(({ key, value }) => `${key}=${value}`)
            .join("&"),
    );
}
