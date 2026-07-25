import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../..";

export function isDictionaryBlockField(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
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
