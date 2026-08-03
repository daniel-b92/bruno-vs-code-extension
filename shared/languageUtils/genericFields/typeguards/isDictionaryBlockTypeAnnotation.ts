import {
    ArrayBlockField,
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    DictionaryBlockTypeAnnotation,
    DictionaryBlockTypeAnnotationValue,
    PlainTextWithinBlock,
} from "../../..";

export function isDictionaryBlockTypeAnnotation(
    field:
        | ArrayBlockField
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | DictionaryBlockTypeAnnotation
        | PlainTextWithinBlock,
): field is DictionaryBlockTypeAnnotation {
    return (
        "range" in field &&
        "value" in field &&
        Object.values(DictionaryBlockTypeAnnotationValue).includes(field.value)
    );
}
