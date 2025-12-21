import { Block, CodeBlock, shouldBeCodeBlock } from "../../../..";

export function isBlockCodeBlock(block: Block): block is CodeBlock {
    return (
        shouldBeCodeBlock(block.name) &&
        block.content instanceof Object &&
        Object.keys(block.content).includes("asTsNode")
    );
}
