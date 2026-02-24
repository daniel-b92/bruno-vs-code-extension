import { DictionaryBlockSimpleField } from "../..";

export function getExpectedUrlQueryParamsForQueryParamsBlock(
    queryParamsBlockFields: DictionaryBlockSimpleField[],
) {
    return new URLSearchParams(
        queryParamsBlockFields
            .filter(({ disabled }) => !disabled)
            .map(({ key, value }) => `${key}=${value}`)
            .join("&"),
    );
}
