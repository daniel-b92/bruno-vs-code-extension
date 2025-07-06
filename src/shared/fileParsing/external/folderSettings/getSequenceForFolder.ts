import { existsSync, lstatSync, readdirSync } from "fs";
import { isFolderSettingsFile } from "../../../fileSystem/util/isFolderSettingsFile";
import { getSequenceFromMetaBlock } from "../shared/getSequenceFromMetaBlock";
import { resolve } from "path";

export function getSequenceForFolder(folderPath: string) {
    if (!existsSync(folderPath) || !lstatSync(folderPath).isDirectory()) {
        return undefined;
    }

    const settingsFileName = readdirSync(folderPath).find(isFolderSettingsFile);

    if (!settingsFileName) {
        return undefined;
    }

    return getSequenceFromMetaBlock(resolve(folderPath, settingsFileName));
}
