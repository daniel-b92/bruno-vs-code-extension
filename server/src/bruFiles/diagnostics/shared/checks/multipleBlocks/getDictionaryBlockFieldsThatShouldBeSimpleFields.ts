import {
    DictionaryBlock,
    isDictionaryBlockField,
    shouldBeDictionaryArrayField,
} from "@global_shared";

export function getDictionaryBlockFieldsThatShouldBeSimpleFields(
    dictionaryBlocks: DictionaryBlock[],
) {
    return dictionaryBlocks
        .map((block) => {
            const keysToCheck = block.content
                .filter(isDictionaryBlockField)
                .map(({ key }) => key)
                .filter(
                    (key) => !shouldBeDictionaryArrayField(block.name, key),
                );

            return keysToCheck.length > 0
                ? {
                      block,
                      keys: keysToCheck,
                  }
                : undefined;
        })
        .filter((val) => val != undefined);
}
