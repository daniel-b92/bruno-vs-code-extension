import {
    RequestFileBlockName,
    DictionaryBlock,
    Block,
    isBlockDictionaryBlock,
} from "../../..";

export function getValidDictionaryBlocksWithName(
    allBlocks: Block[],
    dictionaryBlockName: RequestFileBlockName,
): DictionaryBlock[] {
    return allBlocks
        .filter(({ name }) => name == dictionaryBlockName)
        .filter(isBlockDictionaryBlock);
}
