import { readFile } from "fs";
import { promisify } from "util";

export async function getFileContent(path: string) {
    return await promisify(readFile)(path, {
        encoding: "utf-8",
    }).catch(() => undefined);
}
