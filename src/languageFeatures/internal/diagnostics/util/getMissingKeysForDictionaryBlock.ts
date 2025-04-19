import { DictionaryBlock } from "../../../../shared";

export function getMissingKeysForDictionaryBlock(
    block: DictionaryBlock,
    allExpectedKeys: string[]
) {
    return allExpectedKeys.filter(
        (expectedField) =>
            !block.content.some(({ name }) => expectedField == name)
    );
}
