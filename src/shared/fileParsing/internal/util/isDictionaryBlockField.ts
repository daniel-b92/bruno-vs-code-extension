import {
    ArrayBlockField,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../external/interfaces";

export function isDictionaryBlockField(
    field: ArrayBlockField | DictionaryBlockSimpleField | PlainTextWithinBlock
): field is DictionaryBlockSimpleField {
    return ["key", "value"].every((expected) =>
        Object.keys(field).includes(expected)
    );
}
