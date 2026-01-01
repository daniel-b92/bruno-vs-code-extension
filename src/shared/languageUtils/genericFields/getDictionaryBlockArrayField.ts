import {
    Block,
    isBlockDictionaryBlock,
    isDictionaryBlockArrayField,
} from "../..";

export function getDictionaryBlockArrayField(block: Block, key: string) {
    if (!isBlockDictionaryBlock(block)) {
        return undefined;
    }

    const fieldsByKey = block.content.filter(({ key: k }) => k == key);

    if (
        fieldsByKey.length != 1 ||
        !isDictionaryBlockArrayField(fieldsByKey[0])
    ) {
        return undefined;
    }

    return fieldsByKey[0];
}
