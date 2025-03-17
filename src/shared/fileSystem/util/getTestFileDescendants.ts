import { RelativePattern, workspace } from "vscode";
import { getSequence } from "../testFileParsing/testFileParser";

export const getTestFileDescendants = async (directoryPath: string) => {
    const bruFileUris = await workspace.findFiles(
        new RelativePattern(directoryPath, "**/*.bru")
    );
    return bruFileUris.filter((uri) => getSequence(uri.fsPath) != undefined);
};
