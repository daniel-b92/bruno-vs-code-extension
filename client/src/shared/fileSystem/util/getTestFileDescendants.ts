import { RelativePattern, workspace } from "vscode";
import {
    filterAsync,
    getExtensionForBrunoFiles,
    parseSequenceFromMetaBlock,
} from "../..";

export const getTestFileDescendants = async (directoryPath: string) => {
    const bruFileUris = await workspace.findFiles(
        new RelativePattern(
            directoryPath,
            `**/*${getExtensionForBrunoFiles()}`
        )
    );
    return await filterAsync(
        bruFileUris,
        async (uri) =>
            (await parseSequenceFromMetaBlock(uri.fsPath)) != undefined
    );
};
