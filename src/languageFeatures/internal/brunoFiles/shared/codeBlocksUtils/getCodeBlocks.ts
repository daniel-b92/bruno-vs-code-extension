import { Block, isBlockCodeBlock } from "../../../../../shared";

export function getCodeBlocks(allBlocks: Block[]) {
    return allBlocks.filter((block) => isBlockCodeBlock(block));
}
