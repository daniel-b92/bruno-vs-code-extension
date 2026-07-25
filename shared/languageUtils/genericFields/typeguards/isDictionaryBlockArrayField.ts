import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../..";

export function isDictionaryBlockArrayField(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | PlainTextWithinBlock,
): field is DictionaryBlockArrayField {
    return ["key", "values"].every((expected) =>
        Object.keys(field).includes(expected),
    );
}
