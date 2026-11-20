import {
    Block,
    getActiveFieldFromDictionaryBlock,
    MethodBlockKey,
} from "../../../..";
import { getMethodBlockIfValid } from "./getMethodBlockIfValid";

export function getUrlFieldFromMethodBlock(allBlocks: Block[]) {
    const methodBlock = getMethodBlockIfValid(allBlocks);

    if (!methodBlock) {
        return undefined;
    }

    return getActiveFieldFromDictionaryBlock(methodBlock, MethodBlockKey.Url);
}
