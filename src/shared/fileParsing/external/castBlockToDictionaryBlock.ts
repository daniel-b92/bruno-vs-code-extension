import { DictionaryBlock, RequestFileBlock } from "./interfaces";

export function castBlockToDictionaryBlock(block: RequestFileBlock) {
    return Array.isArray(block.content)
        ? (block as DictionaryBlock)
        : undefined;
}
