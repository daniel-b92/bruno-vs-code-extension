import {
    getFileContent,
    ItemType,
    parseBruFile,
    TextDocumentHelper,
} from "../../..";

export async function parseFileByPath(path: string, itemType: ItemType) {
    const content = await getFileContent(path);

    return content
        ? parseBruFile(new TextDocumentHelper(content), itemType)
        : undefined;
}
