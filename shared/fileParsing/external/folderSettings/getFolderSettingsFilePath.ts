import { readdir } from "fs";
import { doesFileNameMatchFolderSettingsFileName } from "../../..";
import { resolve } from "path";
import { promisify } from "util";
import { doesFileNameMatchCollectionSettingsFile } from "../../../fileSystem/util/doesFileNameMatchCollectionSettingsFile";

export async function getFolderSettingsFilePath(
    isCollectionRootFolder: boolean,
    folderPath: string,
) {
    const childItems = await promisify(readdir)(folderPath).catch(
        () => undefined,
    );

    if (!childItems || childItems.length == 0) {
        return undefined;
    }

    const settingsFileName = childItems.find((name) =>
        isCollectionRootFolder
            ? doesFileNameMatchCollectionSettingsFile(name)
            : doesFileNameMatchFolderSettingsFileName(name),
    );

    return settingsFileName ? resolve(folderPath, settingsFileName) : undefined;
}
