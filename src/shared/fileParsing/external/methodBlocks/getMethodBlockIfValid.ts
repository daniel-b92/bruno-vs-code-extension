import { castBlockToDictionaryBlock, getAllMethodBlocks } from "../../..";
import { RequestFileBlock } from "../interfaces";

export function getMethodBlockIfValid(allBlocks: RequestFileBlock[]) {
    const methodBlocks = getAllMethodBlocks(allBlocks);

    if (methodBlocks.length != 1) {
        return undefined;
    }

    return castBlockToDictionaryBlock(methodBlocks[0]);
}
