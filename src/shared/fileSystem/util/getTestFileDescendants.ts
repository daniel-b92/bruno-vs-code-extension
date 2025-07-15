import { RelativePattern, workspace } from "vscode";
import {
    filterAsync,
    getExtensionForRequestFiles,
    parseSequenceFromMetaBlock,
} from "../..";

export const getTestFileDescendants = async (directoryPath: string) => {
    const bruFileUris = await workspace.findFiles(
        new RelativePattern(
            directoryPath,
            `**/*${getExtensionForRequestFiles()}`
        )
    );
    return await filterAsync(
        bruFileUris,
        async (uri) =>
            (await parseSequenceFromMetaBlock(uri.fsPath)) != undefined
    );
};
