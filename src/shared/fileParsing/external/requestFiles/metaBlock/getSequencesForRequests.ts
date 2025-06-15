import { lstatSync, readdirSync } from "fs";
import { extname, resolve } from "path";
import { getSequenceFromMetaBlock } from "./getSequenceFromMetaBlock";
import { getExtensionForRequestFiles } from "../../../../fileSystem/util/getExtensionForRequestFiles";

export const getSequencesForRequests = (directory: string) => {
    const result: { path: string; sequence: number }[] = [];

    readdirSync(directory).map((childName) => {
        const fullPath = resolve(directory, childName);

        if (
            lstatSync(fullPath).isFile() &&
            extname(fullPath) == getExtensionForRequestFiles() &&
            getSequenceFromMetaBlock(fullPath) != undefined
        ) {
            result.push({
                path: fullPath,
                sequence: getSequenceFromMetaBlock(fullPath) as number,
            });
        }
    });

    return result;
};
