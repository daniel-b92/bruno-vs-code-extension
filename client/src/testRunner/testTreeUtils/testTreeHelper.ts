import { Uri as vsCodeUri } from "vscode";
import { basename } from "path";

export const getTestId = (uri: vsCodeUri) => uri.toString();

export const getTestLabel = (uri: vsCodeUri) => basename(uri.fsPath);
