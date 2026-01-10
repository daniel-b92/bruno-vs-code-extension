import { Block, CodeBlock, shouldBeCodeBlock } from "../../../..";

export function isBlockCodeBlock(block: Block): block is CodeBlock {
    return shouldBeCodeBlock(block.name) && typeof block.content == "string";
}
