import { Uri } from "vscode";
import { TestCollection } from "../../model/testCollection";
import { getSequence } from "../../fileSystem/testFileParser";

export const isValidTestFileFromCollections = (
    uri: Uri,
    collections: TestCollection[]
) =>
    uri.scheme == "file" &&
    uri.fsPath.endsWith(".bru") &&
    getSequence(uri.fsPath) != undefined &&
    collections.some((collection) =>
        uri.fsPath.includes(collection.rootDirectory)
    );
