import { readFile } from "fs/promises";
import { extname } from "path";
import {
    CollectionFormat,
    getFieldFromMetaBlock,
    getFileExtensionForFormat,
    isDictionaryBlockSimpleField,
    MetaBlockKey,
    parseInfoFromYamlFileWithSequence,
    TextDocumentHelper,
} from "../../..";

/**
 * Determines the name that is stored inside the content of a request file, an app file or a folder settings file.
 * The file format is determined by the extension of the given file path.
 *
 * Returns `undefined`, if the format cannot be determined or the file does not contain a name.
 */
export function getStoredItemNameFromFileContent(
    filePath: string,
    content: string,
): string | undefined {
    const documentHelper = new TextDocumentHelper(content);
    const extension = extname(filePath);

    if (extension == getFileExtensionForFormat(CollectionFormat.Bru)) {
        const nameField = getFieldFromMetaBlock(
            documentHelper,
            MetaBlockKey.Name,
        );

        return nameField && isDictionaryBlockSimpleField(nameField)
            ? nameField.value
            : undefined;
    }

    if (extension == getFileExtensionForFormat(CollectionFormat.Yaml)) {
        return parseInfoFromYamlFileWithSequence(filePath, documentHelper)
            .result?.properties.name?.value;
    }

    return undefined;
}

/** See {@link getStoredItemNameFromFileContent}. Returns `undefined` as well, if the file cannot be read. */
export async function getStoredItemNameFromFile(filePath: string) {
    const content = await readFile(filePath, "utf-8").catch(() => undefined);

    return content === undefined
        ? undefined
        : getStoredItemNameFromFileContent(filePath, content);
}
