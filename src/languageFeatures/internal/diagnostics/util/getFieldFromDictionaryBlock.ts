import { DictionaryBlock } from "../../../../shared";

export function getFieldFromDictionaryBlock(
    methodBlock: DictionaryBlock,
    fieldName: string
) {
    const matchingFields = methodBlock.content.filter(
        ({ key }) => key == fieldName
    );

    return matchingFields.length == 1 ? matchingFields[0] : undefined;
}
