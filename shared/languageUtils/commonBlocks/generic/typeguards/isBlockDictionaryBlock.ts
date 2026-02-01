import { Block, DictionaryBlock, isDictionaryBlockField } from "../../../..";

export function isBlockDictionaryBlock(block: Block): block is DictionaryBlock {
    return (
        Array.isArray(block.content) &&
        block.content.length > 0 &&
        block.content.every((content) => isDictionaryBlockField(content))
    );
}
