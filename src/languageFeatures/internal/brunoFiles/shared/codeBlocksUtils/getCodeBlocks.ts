import { Block, shouldBeCodeBlock } from "../../../../../shared";

export function getCodeBlocks(allBlocks: Block[]) {
    return allBlocks.filter(({ name }) => shouldBeCodeBlock(name));
}
