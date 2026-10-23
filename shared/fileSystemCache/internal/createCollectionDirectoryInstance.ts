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
import { getSequenceAndTagsFromYamlFolderSettingsFile } from "./yamlFormat/createYamlCollectionItems";

export async function createCollectionDirectoryInstance(
    folderPath: string,
    format: CollectionFormat,
    folderSettingsFilePath?: string,
) {
    if (!folderSettingsFilePath) {
        return new CollectionDirectory(folderPath);
    }

    if (format == CollectionFormat.Yaml) {
        const { sequence, tags } =
            await getSequenceAndTagsFromYamlFolderSettingsFile(
                folderSettingsFilePath,
            );

        return new CollectionDirectory(
            folderPath,
            folderSettingsFilePath,
            sequence,
            tags,
        );
    }

    const { sequence, tags } =
        await getSequenceAndTagsFromBruFolderSettingsFile(
            folderSettingsFilePath,
        );

    return new CollectionDirectory(
        folderPath,
        folderSettingsFilePath,
        sequence,
        tags,
    );
}

async function getSequenceAndTagsFromBruFolderSettingsFile(path: string) {
    const settingsContent = await getFileContent(path);

    if (settingsContent === undefined) {
        return { sequence: undefined, tags: undefined };
    }

    const metaBlockContent = parseBlockFromFile(
        new TextDocumentHelper(settingsContent),
        RequestFileBlockName.Meta,
    )?.content;

    return Array.isArray(metaBlockContent) &&
        metaBlockContent.every((field) => isDictionaryBlockField(field))
        ? getSequenceAndTagsFromMetaBlock(metaBlockContent)
        : { sequence: undefined, tags: undefined };
}
