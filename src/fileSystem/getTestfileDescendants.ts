import { RelativePattern, workspace } from "vscode";
import { globPatternForTestfiles } from "../testTreeHelper";
import { getSequence } from "./testFileParser";

export const getTestfileDescendants = async (directoryPath: string) => {
    const bruFileUris = await workspace.findFiles(
        new RelativePattern(directoryPath, globPatternForTestfiles)
    );
    return bruFileUris.filter((uri) => getSequence(uri.fsPath) != undefined);
};
