import {
    isBlockDictionaryBlock,
    getActiveFieldFromDictionaryBlock,
    MethodBlockKey,
    Block,
    isDictionaryBlockSimpleField,
    getAllMethodBlocks,
} from "../../..";

export function getActiveFieldFromMethodBlock(
    allBlocks: Block[],
    key: MethodBlockKey,
) {
    const methodBlocks = getAllMethodBlocks(allBlocks);

    if (methodBlocks.length != 1 || !isBlockDictionaryBlock(methodBlocks[0])) {
        return undefined;
    }

    const activeField = getActiveFieldFromDictionaryBlock(methodBlocks[0], key);

    return activeField && isDictionaryBlockSimpleField(activeField)
        ? activeField
        : undefined;
}
