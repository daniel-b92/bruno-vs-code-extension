import { DictionaryBlockField } from "../../../sharedred";

export function isSequenceValid(field: DictionaryBlockField) {
    return /^\d+$/.test(field.value) && Number(field.value) >= 1;
}
