import { DictionaryBlock } from "../..";

export function getPathParamsFromPathParamsBlock(
    pathParamsBlock: DictionaryBlock,
) {
    return pathParamsBlock.content
        .filter(({ disabled }) => !disabled)
        .map(({ key }) => key);
}
