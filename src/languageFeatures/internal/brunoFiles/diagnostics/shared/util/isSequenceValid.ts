import { DictionaryBlockSimpleField } from "../../../../../../shared";

export function isSequenceValid(field: DictionaryBlockSimpleField) {
    return /^\d+$/.test(field.value) && Number(field.value) >= 1;
}
