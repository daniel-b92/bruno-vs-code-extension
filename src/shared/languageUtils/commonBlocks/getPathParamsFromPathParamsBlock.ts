import { DictionaryBlock } from "../interfaces";

export function getPathParamsFromPathParamsBlock(
    pathParamsBlock: DictionaryBlock,
) {
    return pathParamsBlock.content.map(({ key }) => key);
}
