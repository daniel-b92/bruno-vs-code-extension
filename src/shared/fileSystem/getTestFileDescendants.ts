import { RelativePattern, workspace } from "vscode";
import { getSequence } from "./testFileParser";
import { getTestFilesExtension } from "../util/getTestFilesExtension";

export const getTestFileDescendants = async (directoryPath: string) => {
    const bruFileUris = await workspace.findFiles(
        new RelativePattern(directoryPath, `**/*${getTestFilesExtension}`)
    );
    return bruFileUris.filter((uri) => getSequence(uri.fsPath) != undefined);
};
