import {
    ArrayBlockField,
    DictionaryBlockField,
    PlainTextWithinBlock,
} from "./interfaces";

export function isDictionaryBlockField(
    field: ArrayBlockField | DictionaryBlockField | PlainTextWithinBlock
): field is DictionaryBlockField {
    return ["key", "value"].every((expected) =>
        Object.keys(field).includes(expected)
    );
}
