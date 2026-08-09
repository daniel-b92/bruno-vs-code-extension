import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    DictionaryBlockTypeAnnotation,
    PlainTextWithinBlock,
} from "../../../..";

export function isDictionaryBlockDescription(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | DictionaryBlockTypeAnnotation
        | PlainTextWithinBlock,
): field is DictionaryBlockDescription {
    return (
        "range" in field &&
        !("text" in field) &&
        Object.keys(field).every((key) => key === "range")
    );
}
