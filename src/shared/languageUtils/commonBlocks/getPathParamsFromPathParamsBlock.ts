import { DictionaryBlock } from "../../fileParsing/external/interfaces";

export function getPathParamsFromPathParamsBlock(
    pathParamsBlock: DictionaryBlock
) {
    return pathParamsBlock.content.map(({ key }) => key);
}
