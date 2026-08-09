import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../../..";

export function isDictionaryBlockSimpleField(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | PlainTextWithinBlock,
): field is DictionaryBlockSimpleField {
    return ["key", "value"].every((expected) =>
        Object.keys(field).includes(expected),
    );
}
