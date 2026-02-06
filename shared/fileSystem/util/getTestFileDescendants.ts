import {
    getExtensionForBrunoFiles,
    parseSequenceFromMetaBlock,
    filterAsync,
} from "../..";
import { glob } from "glob";

export async function getTestFileDescendants(directoryPath: string) {
    const bruFilePaths = await glob(
        `${directoryPath}/**/*${getExtensionForBrunoFiles()}`,
    );

    return await filterAsync(
        bruFilePaths,
        async (path) => (await parseSequenceFromMetaBlock(path)) != undefined,
    );
}
