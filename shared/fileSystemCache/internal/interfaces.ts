import { Dirent } from "fs";

export type FileSystemData = string | Dirent<string>;

export interface FileSystemItemStats {
    isFile: () => boolean;
    isDirectory: () => boolean;
}
