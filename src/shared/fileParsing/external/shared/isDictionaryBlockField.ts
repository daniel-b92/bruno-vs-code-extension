import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../interfaces";

export function isDictionaryBlockField(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | PlainTextWithinBlock,
): field is DictionaryBlockSimpleField | DictionaryBlockArrayField {
    return (
        // Case when it's a simple field
        ["key", "value"].every((expected) =>
            Object.keys(field).includes(expected),
        ) ||
        // Case when it's an array field
        ["key", "values"].every((expected) =>
            Object.keys(field).includes(expected),
        )
    );
}
