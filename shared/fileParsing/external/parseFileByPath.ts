import { getFileContent, parseBruFile, TextDocumentHelper } from "../..";

export async function parseFileByPath(path: string) {
    const content = await getFileContent(path);

    return content ? parseBruFile(new TextDocumentHelper(content)) : undefined;
}
