import { isDictionaryBlockField } from "../internal/util/isDictionaryBlockField";
import { DictionaryBlock, Block } from "./interfaces";

export function castBlockToDictionaryBlock(block: Block) {
    return Array.isArray(block.content) &&
        block.content.length > 0 &&
        block.content.every((content) => isDictionaryBlockField(content))
        ? (block as DictionaryBlock)
        : undefined;
}
