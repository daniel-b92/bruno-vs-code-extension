import {
    getSequenceFieldFromMetaBlock,
    isDictionaryBlockSimpleField,
    MetaBlockKey,
    RequestFileBlockName,
    TextDocumentHelper,
} from "@global_shared";

export function getRangeForSequenceValue(
    filePath: string,
    docHelper: TextDocumentHelper,
) {
    const fileContent = docHelper.getText();

    const sequenceField = fileContent
        ? getSequenceFieldFromMetaBlock(new TextDocumentHelper(fileContent))
        : undefined;

    if (!sequenceField || !isDictionaryBlockSimpleField(sequenceField)) {
        console.warn(
            `'${
                RequestFileBlockName.Meta
            }' block did not have expected format for file '${filePath}'. Got field for '${
                MetaBlockKey.Sequence
            }': ${sequenceField ? JSON.stringify(sequenceField, null, 2) : "'undefined'"}.`,
        );

        return undefined;
    }

    return sequenceField.valueRange;
}
