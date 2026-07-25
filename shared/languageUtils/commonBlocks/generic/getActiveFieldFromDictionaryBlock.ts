import { DictionaryBlock, isDictionaryBlockField } from "../../..";

export function getActiveFieldFromDictionaryBlock(
    block: DictionaryBlock,
    fieldName: string,
) {
    const matchingFields = block.content
        .filter(isDictionaryBlockField)
        .filter(({ key, disabled }) => !disabled && key == fieldName);

    return matchingFields.length == 1 ? matchingFields[0] : undefined;
}
