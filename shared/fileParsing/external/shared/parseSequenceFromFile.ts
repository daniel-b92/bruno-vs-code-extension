import { lstat, readFile } from "fs";
import { extname } from "path";
import { promisify } from "util";
import {
    checkIfPathExistsAsync,
    CollectionFormat,
    getFileExtensionForFormat,
    parseInfoFromYamlRequestOrFolderFile,
    parseSequenceFromMetaBlock,
    TextDocumentHelper,
} from "../../..";

/** Parses the sequence from a request file or a folder settings file, depending on the file's format. */
export async function parseSequenceFromFile(filePath: string) {
    if (extname(filePath) != getFileExtensionForFormat(CollectionFormat.Yaml)) {
        return await parseSequenceFromMetaBlock(filePath);
    }

    if (
        !(await checkIfPathExistsAsync(filePath)) ||
        !(await promisify(lstat)(filePath)
            .then((stats) => stats.isFile())
            .catch(() => undefined))
    ) {
        return undefined;
    }

    const content = await promisify(readFile)(filePath, "utf-8").catch(
        () => undefined,
    );

    return content === undefined
        ? undefined
        : parseInfoFromYamlRequestOrFolderFile(
              filePath,
              new TextDocumentHelper(content),
          ).result?.properties.sequence?.value;
}
