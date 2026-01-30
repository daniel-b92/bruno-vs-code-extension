import { readdir } from "fs";
import { doesFileNameMatchFolderSettingsFileName } from "../../../../client/src/shared";
import { resolve } from "path";
import { promisify } from "util";

export async function getFolderSettingsFilePath(folderPath: string) {
    const childItems = await promisify(readdir)(folderPath).catch(
        () => undefined,
    );

    if (!childItems || childItems.length == 0) {
        return undefined;
    }

    const settingsFileName = childItems.find(
        doesFileNameMatchFolderSettingsFileName,
    );

    return settingsFileName ? resolve(folderPath, settingsFileName) : undefined;
}
