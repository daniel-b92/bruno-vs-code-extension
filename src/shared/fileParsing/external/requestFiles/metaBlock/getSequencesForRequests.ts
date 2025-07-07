import { lstatSync, readdirSync } from "fs";
import { extname, resolve } from "path";
import { parseSequenceFromMetaBlock } from "../../shared/parseSequenceFromMetaBlock";
import { getExtensionForRequestFiles } from "../../../../fileSystem/util/getExtensionForRequestFiles";

export const getSequencesForRequests = (directory: string) => {
    const result: { path: string; sequence: number }[] = [];

    // ToDo; Handle sequences within folder settings files correctly
    
    readdirSync(directory).map((childName) => {
        const fullPath = resolve(directory, childName);

        if (
            lstatSync(fullPath).isFile() &&
            extname(fullPath) == getExtensionForRequestFiles() &&
            parseSequenceFromMetaBlock(fullPath) != undefined
        ) {
            result.push({
                path: fullPath,
                sequence: parseSequenceFromMetaBlock(fullPath) as number,
            });
        }
    });

    return result;
};
