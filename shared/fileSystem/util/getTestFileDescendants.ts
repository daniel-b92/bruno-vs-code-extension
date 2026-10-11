import {
    parseSequenceFromMetaBlock,
    filterAsync,
    convertToGlobPattern,
    getFileExtensionForFormat,
    CollectionFormat,
} from "../..";
import { glob } from "glob";

export async function getTestFileDescendants(directoryPath: string) {
    const bruFilePaths = await glob(
        `${convertToGlobPattern(directoryPath)}/**/*${getFileExtensionForFormat(CollectionFormat.Bru)}`,
        { absolute: true },
    );

    return await filterAsync(
        bruFilePaths,
        async (path) => (await parseSequenceFromMetaBlock(path)) != undefined,
    );
}
