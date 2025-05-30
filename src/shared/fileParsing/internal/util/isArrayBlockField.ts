import {
    ArrayBlockField,
    DictionaryBlockField,
    PlainTextWithinBlock,
} from "../../external/interfaces";

export function isArrayBlockField(
    field: ArrayBlockField | DictionaryBlockField | PlainTextWithinBlock
): field is ArrayBlockField {
    return ["entry", "entryRange"].every((expected) =>
        Object.keys(field).includes(expected)
    );
}
