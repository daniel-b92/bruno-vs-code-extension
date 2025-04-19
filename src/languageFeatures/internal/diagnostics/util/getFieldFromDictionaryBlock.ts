import { DictionaryBlock } from "../../../../shared";

export function getFieldFromDictionaryBlock(
    methodBlock: DictionaryBlock,
    fieldName: string
) {
    const matchingFields = methodBlock.content.filter(
        ({ name }) => name == fieldName
    );

    return matchingFields.length == 1 ? matchingFields[0] : undefined;
}
