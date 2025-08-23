import { DictionaryBlock } from "../../../../../../shared";

export function getUnknownKeysFromDictionaryBlock(
    block: DictionaryBlock,
    allExpectedKeys: string[]
) {
    return block.content.filter(({ key }) => !allExpectedKeys.includes(key));
}
