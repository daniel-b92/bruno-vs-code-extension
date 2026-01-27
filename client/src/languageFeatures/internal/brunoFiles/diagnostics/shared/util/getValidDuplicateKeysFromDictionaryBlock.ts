import {
    DictionaryBlock,
    DictionaryBlockArrayField,
    DictionaryBlockSimpleField,
} from "../../../../../../shared";

export interface FieldsWithSameKey {
    key: string;
    fields: (DictionaryBlockSimpleField | DictionaryBlockArrayField)[];
}

export function getValidDuplicateKeysFromDictionaryBlock(
    block: DictionaryBlock,
    allValidKeys?: string[],
) {
    const foundValidKeysSorted = block.content
        .filter(({ key }) => (allValidKeys ? allValidKeys.includes(key) : true))
        .sort(({ key: key1 }, { key: key2 }) => (key1 > key2 ? 1 : -1));

    if (foundValidKeysSorted.length == 0) {
        return [];
    }

    const result: FieldsWithSameKey[] = [];

    foundValidKeysSorted.slice(1).forEach((currentField, index) => {
        const previousFieldFromList = foundValidKeysSorted[index];

        if (
            currentField.key == previousFieldFromList.key &&
            !result.some(({ key }) => key == currentField.key)
        ) {
            result.push({
                key: currentField.key,
                fields: [previousFieldFromList, currentField],
            });
        } else if (currentField.key == previousFieldFromList.key) {
            const entryToUpdate = result.find(
                ({ key }) => key == currentField.key,
            ) as FieldsWithSameKey;

            entryToUpdate.fields.push(currentField);
        }
    });

    return result;
}
