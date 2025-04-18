import { DictionaryBlock } from "../../../../shared";
import { MethodBlockFieldName } from "../../../../shared/fileSystem/testFileParsing/definitions/methodBlockFieldNameEnum";

export function getFieldFromMethodBlock(
    methodBlock: DictionaryBlock,
    fieldName: MethodBlockFieldName
) {
    const matchingFields = methodBlock.content.filter(
        ({ name }) => name == fieldName
    );

    return matchingFields.length == 1
        ? matchingFields[0]
        : undefined;
}
