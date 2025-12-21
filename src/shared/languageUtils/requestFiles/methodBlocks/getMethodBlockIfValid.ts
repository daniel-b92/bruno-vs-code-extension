import { isBlockDictionaryBlock, getAllMethodBlocks } from "../../..";
import { Block } from "../../interfaces";

export function getMethodBlockIfValid(allBlocks: Block[]) {
    const methodBlocks = getAllMethodBlocks(allBlocks);

    if (methodBlocks.length != 1 || !isBlockDictionaryBlock(methodBlocks[0])) {
        return undefined;
    }

    return methodBlocks[0];
}
