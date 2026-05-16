import { readFile } from "fs";
import { promisify } from "util";
import { parseBruFile, TextDocumentHelper } from "../..";

export async function parseFileByPath(path: string) {
    const content = await getFileContent(path);

    return content ? parseBruFile(new TextDocumentHelper(content)) : undefined;
}

export async function getFileContent(path: string) {
    return await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);
}
