import * as vscode from "vscode";
import { globPatternForTestfiles } from "../testTreeHelper";
import { getSequence } from "./parser";

export const getTestfileDescendants = async (directoryPath: string) => {
    const bruFileUris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(directoryPath, globPatternForTestfiles)
    );
    return bruFileUris.filter((uri) => getSequence(uri.fsPath) != undefined);
};
