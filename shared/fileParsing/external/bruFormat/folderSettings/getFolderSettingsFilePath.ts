import { readdir } from "fs";
import {
    CollectionFormat,
    doesFileNameMatchCollectionSettingsFile,
    doesFileNameMatchFolderSettingsFileName,
} from "../../../..";
import { resolve } from "path";
import { promisify } from "util";

export async function getFolderSettingsFilePath(
    isCollectionRootFolder: boolean,
    folderPath: string,
    format = CollectionFormat.Bru,
) {
    const childItems = await promisify(readdir)(folderPath).catch(
        () => undefined,
    );

    if (!childItems || childItems.length == 0) {
        return undefined;
    }

    const settingsFileName = childItems.find((name) =>
        isCollectionRootFolder
            ? doesFileNameMatchCollectionSettingsFile(name, format)
            : doesFileNameMatchFolderSettingsFileName(name, format),
    );

    return settingsFileName ? resolve(folderPath, settingsFileName) : undefined;
}
