import { isArrayBlockField } from "../../../genericFields/typeguards/isArrayBlockField";
import { Block, ArrayBlock } from "../../../interfaces";

export function isBlockArrayBlock(block: Block): block is ArrayBlock {
    return (
        Array.isArray(block.content) &&
        block.content.length > 0 &&
        block.content.every((content) => isArrayBlockField(content))
    );
}
