import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../interfaces";

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
