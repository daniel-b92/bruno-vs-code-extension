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
    format: CollectionFormat,
    folderSettingsFilePath?: string,
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

    return new CollectionDirectory(
        folderPath,
        folderSettingsFilePath,
        await getSequenceFromBruFolderSettingsFile(folderSettingsFilePath),
    );
}

async function getSequenceFromBruFolderSettingsFile(path: string) {
    const settingsContent = await getFileContent(path);

    if (settingsContent === undefined) {
        return undefined;
    }

    const metaBlockContent = parseBlockFromFile(
        new TextDocumentHelper(settingsContent),
        RequestFileBlockName.Meta,
    )?.content;

    return Array.isArray(metaBlockContent) &&
        metaBlockContent.every((field) => isDictionaryBlockField(field))
        ? getSequenceAndTagsFromMetaBlock(metaBlockContent).sequence
        : undefined;
}
