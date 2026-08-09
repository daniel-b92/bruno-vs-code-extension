import { DictionaryBlock, isDictionaryBlockField } from "../../..";

export function getPathParamsFromPathParamsBlock(
    pathParamsBlock: DictionaryBlock,
) {
    return pathParamsBlock.content
        .filter(isDictionaryBlockField)
        .filter(({ disabled }) => !disabled)
        .map(({ key }) => key);
}
