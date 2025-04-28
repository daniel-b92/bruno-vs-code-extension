import { DictionaryBlock } from "../testFileParsing/external/interfaces";

export function getPathParamsFromPathParamsBlock(
    pathParamsBlock: DictionaryBlock
) {
    return pathParamsBlock.content.map(({ key }) => key);
}
