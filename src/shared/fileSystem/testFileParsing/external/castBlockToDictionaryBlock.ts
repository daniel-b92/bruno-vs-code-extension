import { DictionaryBlock, RequestFileBlock } from "./definitions/interfaces";

export function castBlockToDictionaryBlock(block: RequestFileBlock) {
    return Array.isArray(block.content)
        ? (block as DictionaryBlock)
        : undefined;
}
