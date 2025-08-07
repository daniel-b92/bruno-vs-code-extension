import { DictionaryBlock } from "../../../sharedred";

export function getUnknownKeysFromDictionaryBlock(
    block: DictionaryBlock,
    allExpectedKeys: string[]
) {
    return block.content.filter(({ key }) => !allExpectedKeys.includes(key));
}
