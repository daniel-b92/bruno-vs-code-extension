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
    if (!("range" in field)) {
        return false;
    }

    if (!("multilineValueSpecificData" in field)) {
        return Object.keys(field).length == 1;
    }

    return !field.multilineValueSpecificData
        ? Object.keys(field).length == 2
        : typeof field.multilineValueSpecificData == "object";
}
