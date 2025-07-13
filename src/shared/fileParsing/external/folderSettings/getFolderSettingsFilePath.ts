import { readdirSync } from "fs";
import { doesFileNameMatchFolderSettingsFileName } from "../../..";
import { resolve } from "path";

export function getFolderSettingsFilePath(folderPath: string) {
    const settingsFileName = readdirSync(folderPath).find(
        doesFileNameMatchFolderSettingsFileName
    );

    return settingsFileName ? resolve(folderPath, settingsFileName) : undefined;
}
