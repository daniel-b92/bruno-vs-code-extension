import {
    ArrayBlockField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../external/interfaces";

export function isArrayBlockField(
    field: ArrayBlockField | DictionaryBlockSimpleField | PlainTextWithinBlock
): field is ArrayBlockField {
    return ["entry", "entryRange"].every((expected) =>
        Object.keys(field).includes(expected)
    );
}
