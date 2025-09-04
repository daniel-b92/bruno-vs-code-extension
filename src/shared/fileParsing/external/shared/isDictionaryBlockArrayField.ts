import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../interfaces";

export function isDictionaryBlockArrayField(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | PlainTextWithinBlock,
): field is DictionaryBlockArrayField {
    return ["key", "values"].every((expected) =>
        Object.keys(field).includes(expected),
    );
}
