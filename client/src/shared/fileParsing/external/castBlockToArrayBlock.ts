import { isArrayBlockField } from "../internal/util/isArrayBlockField";
import { Block, ArrayBlock } from "./interfaces";

export function castBlockToArrayBlock(block: Block) {
    return Array.isArray(block.content) &&
        block.content.length > 0 &&
        block.content.every((content) => isArrayBlockField(content))
        ? (block as ArrayBlock)
        : undefined;
}
