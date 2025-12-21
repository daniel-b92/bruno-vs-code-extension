import { isBlockDictionaryBlock } from "../..";
import { RequestFileBlockName } from "../../languageUtils/requestFiles/requestFileBlockNameEnum";
import { DictionaryBlock, Block } from "./interfaces";

export function getValidDictionaryBlocksWithName(
    allBlocks: Block[],
    dictionaryBlockName: RequestFileBlockName,
): DictionaryBlock[] {
    return allBlocks
        .filter(({ name }) => name == dictionaryBlockName)
        .filter(isBlockDictionaryBlock);
}
