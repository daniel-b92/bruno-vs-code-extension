import { readFile } from "fs";
import { promisify } from "util";
import {
    getSequenceFieldFromMetaBlock,
    isDictionaryBlockSimpleField,
    mapToVsCodeRange,
    MetaBlockKey,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../../../shared";

export async function getRangeForSequenceValue(filePath: string) {
    const readFileAsync = promisify(readFile);
    const fileContent = await readFileAsync(filePath, "utf-8").catch(
        () => undefined,
    );

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

    return mapToVsCodeRange(sequenceField.valueRange);
}
