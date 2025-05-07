import {
    castBlockToDictionaryBlock,
    getFieldFromDictionaryBlock,
    MethodBlockKey,
    Block,
} from "../..";

export function getFieldFromMethodBlock(
    methodBlock: Block,
    key: MethodBlockKey
) {
    const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);

    if (!castedMethodBlock) {
        return undefined;
    }

    return getFieldFromDictionaryBlock(castedMethodBlock, key);
}
