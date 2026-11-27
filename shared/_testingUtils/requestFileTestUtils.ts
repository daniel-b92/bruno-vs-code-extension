import { readdir } from "fs/promises";
import { join } from "path";
import { CollectionFormat } from "../baseModel/interfaces";
import { parseSequenceFromFile } from "../fileParsing/external/shared/parseSequenceFromFile";
import { getFileExtensionForFormat } from "../fileSystem/util/collectionFormatFileNames";

/** Builds the content of a minimal http request file. For Bru files, further blocks can be appended. */
export function requestContent(
    format: CollectionFormat,
    name: string,
    sequence?: number,
    additionalBruBlocks = "",
) {
    const sequenceLine = sequence === undefined ? "" : `  seq: ${sequence}\n`;

    return format == CollectionFormat.Bru
        ? `meta {\n  name: ${name}\n  type: http\n${sequenceLine}}\n${additionalBruBlocks}`
        : `info:\n  name: ${name}\n  type: http\n${sequenceLine}\nhttp:\n  method: GET\n  url: ""\n`;
}

/** A block for a Bru file with a `bru.runRequest` call for the given path. */
export function runRequestBlock(path: string) {
    return `\nscript:pre-request {\n  await bru.runRequest("${path}");\n}\n`;
}

/** Returns the sequences of all request files in the directory (keys are the file names). */
export async function getRequestSequences(directory: string) {
    const sequences: Record<string, number | undefined> = {};
    const extensions = [CollectionFormat.Bru, CollectionFormat.Yaml].map(
        getFileExtensionForFormat,
    );

    for (const name of (await readdir(directory)).filter((name) =>
        extensions.some((extension) => name.endsWith(extension)),
    )) {
        sequences[name] = await parseSequenceFromFile(join(directory, name));
    }

    return sequences;
}
