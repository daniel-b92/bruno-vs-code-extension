import { readdir } from "fs";
import { doesFileNameMatchFolderSettingsFileName } from "../../..";
import { resolve } from "path";
import { promisify } from "util";

export async function getFolderSettingsFilePath(folderPath: string) {
    const childItems = await promisify(readdir)(folderPath);

    const settingsFileName = childItems.find(
        doesFileNameMatchFolderSettingsFileName
    );

    return settingsFileName ? resolve(folderPath, settingsFileName) : undefined;
}
