import { readFile } from "fs";
import { promisify } from "util";
import {
    CollectionDirectory,
    getAllVariablesFromBlocks,
    getSequenceAndTagsFromMetaBlock,
    getValidDictionaryBlocksWithName,
    isDictionaryBlockField,
    parseBlockFromFile,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../..";

export async function createCollectionDirectoryInstance(
    folderPath: string,
    includeAdditionalData: boolean,
    folderSettingsFilePath?: string,
) {
    if (!folderSettingsFilePath) {
        return new CollectionDirectory(folderPath);
    }

    if (!includeAdditionalData) {
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

    const settingsFileBlocks = await parseFile(folderSettingsFilePath);
    const metaBlocks = settingsFileBlocks
        ? getValidDictionaryBlocksWithName(
              settingsFileBlocks,
              RequestFileBlockName.Meta,
          )
        : [];

    if (
        !settingsFileBlocks ||
        metaBlocks.length != 1 ||
        !Array.isArray(metaBlocks[0].content) ||
        metaBlocks[0].content.some((field) => !isDictionaryBlockField(field))
    ) {
        return new CollectionDirectory(folderPath);
    }

    const { sequence } = getSequenceAndTagsFromMetaBlock(metaBlocks[0].content);

    const variables = settingsFileBlocks
        ? getAllVariablesFromBlocks(settingsFileBlocks)
        : [];
    return new CollectionDirectory(
        folderPath,
        folderSettingsFilePath,
        sequence,
        variables,
    );
}

async function parseFile(path: string) {
    const content = await getFileContent(path);

    return content
        ? parseBruFile(new TextDocumentHelper(content)).blocks
        : undefined;
}

async function getFileContent(path: string) {
    return await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);
}
