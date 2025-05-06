import {
    ArrayBlockField,
    DictionaryBlockField,
} from "../../external/interfaces";

export function isArrayBlockField(
    block: ArrayBlockField | DictionaryBlockField
): block is ArrayBlockField {
    return (block as ArrayBlockField) != undefined;
}
