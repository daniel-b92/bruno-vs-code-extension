import {
    CollectionDirectory,
    CollectionFormat,
    getFileContent,
    getSequenceAndTagsFromMetaBlock,
    isDictionaryBlockField,
    parseBlockFromFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../..";
import { getSequenceFromYamlFolderSettingsFile } from "./yamlFormat/createYamlCollectionItems";

export async function createCollectionDirectoryInstance(
    folderPath: string,
    folderSettingsFilePath?: string,
    format = CollectionFormat.Bru,
) {
    if (!folderSettingsFilePath) {
        return new CollectionDirectory(folderPath);
    }

    if (format == CollectionFormat.Yaml) {
        return new CollectionDirectory(
            folderPath,
            folderSettingsFilePath,
            await getSequenceFromYamlFolderSettingsFile(folderSettingsFilePath),
        );
    }

    const settingsContent = await getFileContent(folderSettingsFilePath);

    if (settingsContent === undefined) {
        return undefined;
    }

    const metaBlockContent = parseBlockFromFile(
        new TextDocumentHelper(settingsContent),
        RequestFileBlockName.Meta,
    )?.content;

    const isDictionaryBlock =
        Array.isArray(metaBlockContent) &&
        metaBlockContent.every((field) => isDictionaryBlockField(field));

    if (!isDictionaryBlock) {
        return new CollectionDirectory(folderPath);
    }

    const { sequence } = getSequenceAndTagsFromMetaBlock(metaBlockContent);
    return new CollectionDirectory(
        folderPath,
        folderSettingsFilePath,
        sequence,
    );
}
