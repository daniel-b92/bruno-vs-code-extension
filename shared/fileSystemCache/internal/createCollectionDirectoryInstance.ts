import { readFile } from "fs";
import { promisify } from "util";
import {
    CollectionDirectory,
    getSequenceAndTagsFromMetaBlock,
    isDictionaryBlockField,
    parseBlockFromFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../..";

export async function createCollectionDirectoryInstance(
    folderPath: string,
    folderSettingsFilePath?: string,
) {
    if (!folderSettingsFilePath) {
        return new CollectionDirectory(folderPath);
    }

    const settingsContent = await getFileContent(folderSettingsFilePath);

    if (settingsContent === undefined) {
        return undefined;
    }

    const metaBlockContent = parseBlockFromFile(
        new TextDocumentHelper(settingsContent),
        RequestFileBlockName.Meta,
    );

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

async function getFileContent(path: string) {
    return await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);
}
