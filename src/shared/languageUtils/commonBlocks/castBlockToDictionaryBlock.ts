import { Block, DictionaryBlock, isDictionaryBlockField } from "../..";

export function castBlockToDictionaryBlock(block: Block) {
    return Array.isArray(block.content) &&
        block.content.length > 0 &&
        block.content.every((content) => isDictionaryBlockField(content))
        ? (block as DictionaryBlock)
        : undefined;
}
