import {
    TextDocumentHelper,
    EnvironmentFileBlockName,
    isBlockDictionaryBlock,
    isDictionaryBlockSimpleField,
    parseBlockFromFile,
    parseBruFile,
    RequestFileBlockName,
    isDictionaryBlockField,
    Collection,
    BrunoRequestFile,
    BrunoFileType,
    BrunoEnvironmentFile,
    NonBrunoSpecificItemType,
    NonBrunoFile,
    DictionaryBlockSimpleField,
    getFolderSettingsFilePath,
    BrunoFolderSettingsFile,
    getSequenceAndTagsFromMetaBlock,
    ItemType,
    CollectionItem,
    getFileContent,
    getAllExtendsFields,
    BrunoCollectionSettingsFile,
    BrunoAppFile,
    CollectionFormat,
} from "../..";
import {
    createYamlEnvironmentFileInstance,
    createYamlRequestFileInstance,
} from "./yamlFormat/createYamlCollectionItems";
import { createCollectionDirectoryInstance } from "./createCollectionDirectoryInstance";

export async function getCollectionItem<T>(
    collection: Collection<T>,
    data: { path: string; itemType: ItemType },
) {
    const { itemType, path } = data;

    switch (itemType) {
        case NonBrunoSpecificItemType.Directory:
            return await createCollectionDirectoryInstance(
                path,
                await getFolderSettingsFilePath(
                    collection.isRootDirectory(path),
                    path,
                    collection.getFormat(),
                ),
                collection.getFormat(),
            );
        default:
            return await getCollectionItemForFile(
                path,
                itemType,
                collection.getFormat(),
            );
    }
}

export async function getCollectionItemForFile(
    path: string,
    itemType: ItemType,
    format = CollectionFormat.Bru,
): Promise<CollectionItem | undefined> {
    const isYaml = format == CollectionFormat.Yaml;

    switch (itemType) {
        case BrunoFileType.CollectionSettingsFile:
            return new BrunoCollectionSettingsFile(path);
        case BrunoFileType.FolderSettingsFile:
            return new BrunoFolderSettingsFile(path);
        case BrunoFileType.EnvironmentFile:
            return isYaml
                ? await createYamlEnvironmentFileInstance(path)
                : await createEnvironmentFileInstance(path);
        case BrunoFileType.RequestFile:
            return isYaml
                ? await createYamlRequestFileInstance(path)
                : await createRequestFileInstance(path);
        case BrunoFileType.AppFile:
            return new BrunoAppFile(path);
        case NonBrunoSpecificItemType.OtherFileType:
            return new NonBrunoFile(path);
        default:
            return undefined;
    }
}

async function createEnvironmentFileInstance(path: string) {
    const content = await getFileContent(path);

    if (content == undefined) {
        return new BrunoEnvironmentFile(path, []);
    }

    const docHelper = new TextDocumentHelper(content);
    const { blocks, textOutsideOfBlocks } = parseBruFile(
        docHelper,
        BrunoFileType.EnvironmentFile,
    );

    const extendsFields = getAllExtendsFields(docHelper, textOutsideOfBlocks);
    const extendsEnvironmentName =
        extendsFields.length == 1 ? extendsFields[0].value : undefined;

    const varsBlocks = blocks.filter(
        ({ name }) => name == EnvironmentFileBlockName.Vars,
    );

    if (varsBlocks.length != 1) {
        return new BrunoEnvironmentFile(path, [], extendsEnvironmentName);
    }

    const varsBlock = varsBlocks[0];

    if (!isBlockDictionaryBlock(varsBlock)) {
        return new BrunoEnvironmentFile(path, [], extendsEnvironmentName);
    }

    return new BrunoEnvironmentFile(
        path,
        varsBlock.content.filter(
            (field) => isDictionaryBlockSimpleField(field) && !field.disabled,
        ) as DictionaryBlockSimpleField[],
        extendsEnvironmentName,
    );
}

async function createRequestFileInstance(path: string) {
    const fileContent = await getFileContent(path);

    if (fileContent === undefined) {
        return undefined;
    }

    const metaBlockContent = parseBlockFromFile(
        new TextDocumentHelper(fileContent),
        RequestFileBlockName.Meta,
    )?.content;

    const isDictionaryBlock =
        Array.isArray(metaBlockContent) &&
        metaBlockContent.every((field) => isDictionaryBlockField(field));

    if (!isDictionaryBlock) {
        return new BrunoRequestFile(path);
    }

    const { sequence, tags } =
        getSequenceAndTagsFromMetaBlock(metaBlockContent);
    return new BrunoRequestFile(path, sequence, tags);
}
