import { resolve } from "path";
import { FileSystemData, FileSystemItemStats } from "./interfaces";
import { promisify } from "util";
import { lstat } from "fs";

export function getFileSystemDataPath(data: FileSystemData) {
    return typeof data == "string" ? data : resolve(data.parentPath, data.name);
}

export async function getFileSystemDataStats(
    data: FileSystemData,
): Promise<FileSystemItemStats | undefined> {
    return typeof data != "string"
        ? data
        : await promisify(lstat)(data).catch(() => undefined);
}
