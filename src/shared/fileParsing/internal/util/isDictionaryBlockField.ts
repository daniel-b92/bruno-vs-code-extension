import {
    ArrayBlockField,
    DictionaryBlockField,
} from "../../external/interfaces";

export function isDictionaryBlockField(
    field: ArrayBlockField | DictionaryBlockField
): field is DictionaryBlockField {
    return (field as DictionaryBlockField) != undefined;
}
