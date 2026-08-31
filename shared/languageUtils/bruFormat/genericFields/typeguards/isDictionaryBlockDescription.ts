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

    if (!field.multilineValueSpecificData) {
        return Object.keys(field).length == 2;
    }

    return typeof field.multilineValueSpecificData == "object";
}
