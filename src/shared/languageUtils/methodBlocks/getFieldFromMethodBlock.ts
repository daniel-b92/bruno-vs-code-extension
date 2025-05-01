import {
    castBlockToDictionaryBlock,
    getFieldFromDictionaryBlock,
    MethodBlockKey,
    RequestFileBlock,
} from "../..";

export function getFieldFromMethodBlock(
    methodBlock: RequestFileBlock,
    key: MethodBlockKey
) {
    const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);

    if (!castedMethodBlock) {
        return undefined;
    }

    return getFieldFromDictionaryBlock(castedMethodBlock, key);
}
