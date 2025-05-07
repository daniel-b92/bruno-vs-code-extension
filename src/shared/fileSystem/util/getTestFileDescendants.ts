import { RelativePattern, workspace } from "vscode";
import { getSequenceFromMetaBlock } from "../..";

export const getTestFileDescendants = async (directoryPath: string) => {
    const bruFileUris = await workspace.findFiles(
        new RelativePattern(directoryPath, "**/*.bru")
    );
    return bruFileUris.filter(
        (uri) => getSequenceFromMetaBlock(uri.fsPath) != undefined
    );
};
