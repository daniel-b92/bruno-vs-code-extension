import { DictionaryBlockField } from "../../../../../../shared";

export function isSequenceValid(field: DictionaryBlockField) {
    return /^\d+$/.test(field.value) && Number(field.value) >= 1;
}
