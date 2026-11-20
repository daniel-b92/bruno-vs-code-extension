import {
    CollectionFormat,
    getFileContent,
    getVariableScopeSectionsFromBlocks,
    getVariableScopeSectionsFromYamlFile,
    ItemType,
    parseBruFile,
    TextDocumentHelper,
    VariableScopeSection,
} from "../../..";

/**
 * @param itemType For the Yaml format, this needs to be a specific file type (not a directory).
 */
export function getVariableScopeSectionsFromFile(
    fileContent: string,
    itemType: ItemType,
    format: CollectionFormat,
): VariableScopeSection[] {
    const docHelper = new TextDocumentHelper(fileContent);

    switch (format) {
        case CollectionFormat.Bru:
            return getVariableScopeSectionsFromBlocks(
                parseBruFile(docHelper, itemType).blocks,
            );
        case CollectionFormat.Yaml:
            return getVariableScopeSectionsFromYamlFile(docHelper, itemType);
    }
}

export async function getVariableScopeSectionsFromFileByPath(
    path: string,
    itemType: ItemType,
    format: CollectionFormat,
) {
    const content = await getFileContent(path);

    return content
        ? getVariableScopeSectionsFromFile(content, itemType, format)
        : undefined;
}
