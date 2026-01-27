import {
    isBlockDictionaryBlock,
    getFieldFromDictionaryBlock,
    MethodBlockKey,
    Block,
} from "../../..";

export function getFieldFromMethodBlock(
    methodBlock: Block,
    key: MethodBlockKey,
) {
    return isBlockDictionaryBlock(methodBlock)
        ? getFieldFromDictionaryBlock(methodBlock, key)
        : undefined;
}
