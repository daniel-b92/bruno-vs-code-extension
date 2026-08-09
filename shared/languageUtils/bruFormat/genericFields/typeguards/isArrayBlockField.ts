import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../../..";

export function isArrayBlockField(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | PlainTextWithinBlock,
): field is ArrayBlockField {
    return ["entry", "entryRange"].every((expected) =>
        Object.keys(field).includes(expected),
    );
}
