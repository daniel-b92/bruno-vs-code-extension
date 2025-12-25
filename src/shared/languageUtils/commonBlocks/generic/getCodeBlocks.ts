import { Block, isBlockCodeBlock } from "../../..";

export function getCodeBlocks(allBlocks: Block[]) {
    return allBlocks.filter((block) => isBlockCodeBlock(block));
}
