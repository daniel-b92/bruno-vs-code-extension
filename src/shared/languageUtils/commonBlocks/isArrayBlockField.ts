import {
    ArrayBlockField,
    DictionaryBlockField,
    PlainTextWithinBlock,
} from "../../fileParsing/external/interfaces";

export function isArrayBlockField(
    field: ArrayBlockField | DictionaryBlockField | PlainTextWithinBlock
): field is ArrayBlockField {
    return ["entry", "entryRange"].every((expected) =>
        Object.keys(field).includes(expected)
    );
}
