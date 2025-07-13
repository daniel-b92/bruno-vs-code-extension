import { RelativePattern, workspace } from "vscode";
import { getExtensionForRequestFiles, parseSequenceFromMetaBlock } from "../..";

export const getTestFileDescendants = async (directoryPath: string) => {
    const bruFileUris = await workspace.findFiles(
        new RelativePattern(
            directoryPath,
            `**/*${getExtensionForRequestFiles()}`
        )
    );
    return Promise.all(
        bruFileUris.filter(
            async (uri) =>
                (await parseSequenceFromMetaBlock(uri.fsPath)) != undefined
        )
    );
};
