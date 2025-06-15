import { castBlockToDictionaryBlock, getAllMethodBlocks } from "../../../..";
import { Block } from "../../interfaces";

export function getMethodBlockIfValid(allBlocks: Block[]) {
    const methodBlocks = getAllMethodBlocks(allBlocks);

    if (methodBlocks.length != 1) {
        return undefined;
    }

    return castBlockToDictionaryBlock(methodBlocks[0]);
}
