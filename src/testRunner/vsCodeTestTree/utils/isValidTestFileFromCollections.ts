import { Uri } from "vscode";
import { TestCollection } from "../../testData/testCollection";
import { getSequence } from "../../../shared/fileSystem/testFileParser";
import { normalizeDirectoryPath } from "../../../shared/fileSystem/util/normalizeDirectoryPath";

export const isValidTestFileFromCollections = (
    uri: Uri,
    collections: TestCollection[]
) =>
    uri.scheme == "file" &&
    uri.fsPath.endsWith(".bru") &&
    getSequence(uri.fsPath) != undefined &&
    collections.some((collection) =>
        uri.fsPath.startsWith(normalizeDirectoryPath(collection.rootDirectory))
    );
