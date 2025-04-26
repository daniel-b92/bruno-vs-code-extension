import { DictionaryBlock } from "../testFileParsing/external/interfaces";

export function getExpectedMethodBlockUrlSubstringsForPathParamsBlock(
    pathParamsBlock: DictionaryBlock
) {
    return pathParamsBlock.content.map(({ key }) => `/:${key}`);
}
