import { DictionaryBlock } from "../../../sharedred";

export function getFieldsWithEmptyValuesForDictionaryBlock(
    block: DictionaryBlock
) {
    return block.content.filter(({ value }) => /^\s*$/.test(value));
}
