import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../..";

export function isArrayBlockField(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | PlainTextWithinBlock,
): field is ArrayBlockField {
    return ["entry", "entryRange"].every((expected) =>
        Object.keys(field).includes(expected),
    );
}
