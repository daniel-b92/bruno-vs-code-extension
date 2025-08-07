import { DictionaryBlock } from "../../../sharedred";

export function getMissingKeysForDictionaryBlock(
    block: DictionaryBlock,
    allExpectedKeys: string[]
) {
    return allExpectedKeys.filter(
        (expectedField) =>
            !block.content.some(({ key }) => expectedField == key)
    );
}
