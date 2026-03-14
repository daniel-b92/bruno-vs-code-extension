import {
    getExtensionForBrunoFiles,
    parseSequenceFromMetaBlock,
    filterAsync,
    convertToGlobPattern,
} from "../..";
import { glob } from "glob";

export async function getTestFileDescendants(directoryPath: string) {
    const bruFilePaths = await glob(
        `${convertToGlobPattern(directoryPath)}/**/*${getExtensionForBrunoFiles()}`,
        { absolute: true },
    );

    return await filterAsync(
        bruFilePaths,
        async (path) => (await parseSequenceFromMetaBlock(path)) != undefined,
    );
}
