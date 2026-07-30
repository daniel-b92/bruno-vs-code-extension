import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    PlainTextWithinBlock,
} from "../../..";

export function isDictionaryBlockDescription(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | PlainTextWithinBlock,
): field is DictionaryBlockDescription {
    return (
        "range" in field &&
        !("text" in field) &&
        Object.keys(field).every((key) => key === "range")
    );
}
