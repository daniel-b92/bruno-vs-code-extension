import { DictionaryBlockSimpleField } from "@global_shared";

export function doesDictionaryBlockFieldHaveValidIntegerValue(
    field: DictionaryBlockSimpleField,
    minValue: number,
) {
    return /^\d+$/.test(field.value) && Number(field.value) >= minValue;
}
