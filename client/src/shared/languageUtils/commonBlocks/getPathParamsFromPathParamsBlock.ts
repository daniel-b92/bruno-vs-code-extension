import { DictionaryBlock } from "../..";

export function getPathParamsFromPathParamsBlock(
    pathParamsBlock: DictionaryBlock,
) {
    return pathParamsBlock.content.map(({ key }) => key);
}
