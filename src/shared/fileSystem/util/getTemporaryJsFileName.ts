import { resolve } from "path";

export function getTemporaryJsFileNameInFolder(folderPath: string) {
    return resolve(folderPath, getTemporaryJsFileBasename());
}

export function getTemporaryJsFileBasename() {
    return "__temp_bru_reference.js";
}
