import { resolve } from "path";

export function getTemporaryJsFileNameInFolder(folderPath: string) {
    return resolve(folderPath, "__temp_bru_reference.js");
}
