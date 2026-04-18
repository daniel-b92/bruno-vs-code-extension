import {
    isBlockDictionaryBlock,
    getActiveFieldFromDictionaryBlock,
    Block,
    isDictionaryBlockSimpleField,
} from "../../..";

export function getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
    allBlocks: Block[],
    blockName: string,
    key: string,
) {
    const matchingBlocks = allBlocks.filter(({ name }) => name == blockName);

    if (
        matchingBlocks.length != 1 ||
        !isBlockDictionaryBlock(matchingBlocks[0])
    ) {
        return undefined;
    }

    const activeField = getActiveFieldFromDictionaryBlock(
        matchingBlocks[0],
        key,
    );

    return activeField && isDictionaryBlockSimpleField(activeField)
        ? activeField
        : undefined;
}
