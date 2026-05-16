import { Dirent } from "fs";

export type FileSystemData = string | Dirent<string>;

export interface ItemStats {
    isFile: () => boolean;
    isDirectory: () => boolean;
}
