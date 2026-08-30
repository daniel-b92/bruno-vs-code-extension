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
    if (!("range" in field) || "text" in field) {
        return false;
    }

    if (
        !("multilineValueSpecificData" in field) ||
        !field.multilineValueSpecificData
    ) {
        return true;
    }

    return typeof field.multilineValueSpecificData == "object";
}
