import {
    DictionaryBlockArrayField,
    DictionaryBlockDescription,
    DictionaryBlockSimpleField,
    DictionaryBlockTypeAnnotation,
    isDictionaryBlockDescription,
    isDictionaryBlockTypeAnnotation,
} from "@global_shared";

export function getSortedDictionaryBlockFieldsByPosition(
    unsorted: (
        | DictionaryBlockSimpleField
        | DictionaryBlockArrayField
        | DictionaryBlockDescription
        | DictionaryBlockTypeAnnotation
    )[],
) {
    return unsorted
        .map((field) => ({
            ...field,
            line:
                isDictionaryBlockDescription(field) ||
                isDictionaryBlockTypeAnnotation(field)
                    ? field.range.start.line
                    : field.keyRange.start.line,
        }))
        .sort(({ line: line1 }, { line: line2 }) => line1 - line2)
        .map(({ line, ...val }) => val);
}
