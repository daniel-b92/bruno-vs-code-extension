import {
    isBlockDictionaryBlock,
    getActiveFieldFromDictionaryBlock,
    MethodBlockKey,
    Block,
} from "../../..";

export function getActiveFieldFromMethodBlock(
    methodBlock: Block,
    key: MethodBlockKey,
) {
    return isBlockDictionaryBlock(methodBlock)
        ? getActiveFieldFromDictionaryBlock(methodBlock, key)
        : undefined;
}
