import { lstatSync, readdirSync } from "fs";
import { extname, resolve } from "path";
import { getSequence } from "../requestFileParser";

export const getSequencesForRequests = (directory: string) => {
    const result: { path: string; sequence: number }[] = [];

    readdirSync(directory).map((childName) => {
        const fullPath = resolve(directory, childName);

        if (
            lstatSync(fullPath).isFile() &&
            extname(fullPath) == ".bru" &&
            getSequence(fullPath) != undefined
        ) {
            result.push({
                path: fullPath,
                sequence: getSequence(fullPath) as number,
            });
        }
    });

    return result;
};
