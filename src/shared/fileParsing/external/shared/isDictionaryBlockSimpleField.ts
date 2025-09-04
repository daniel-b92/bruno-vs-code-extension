import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../interfaces";

export function isDictionaryBlockSimpleField(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | PlainTextWithinBlock,
): field is DictionaryBlockSimpleField {
    return ["key", "value"].every((expected) =>
        Object.keys(field).includes(expected),
    );
}
