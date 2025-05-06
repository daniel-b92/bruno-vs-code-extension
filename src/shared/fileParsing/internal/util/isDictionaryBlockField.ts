import {
    ArrayBlockField,
    DictionaryBlockField,
} from "../../external/interfaces";

export function isDictionaryBlockField(
    block: ArrayBlockField | DictionaryBlockField
): block is DictionaryBlockField {
    return (block as DictionaryBlockField) != undefined;
}
