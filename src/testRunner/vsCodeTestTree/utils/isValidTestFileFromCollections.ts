import { Uri } from "vscode";
import { TestCollection } from "../../testData/testCollection";
import { getSequence } from "../../../shared/fileSystem/testFileParser";
import { getTestFilesExtension } from "../../../shared/util/getTestFilesExtension";

export const isValidTestFileFromCollections = (
    uri: Uri,
    collections: TestCollection[]
) =>
    uri.scheme == "file" &&
    uri.fsPath.endsWith(getTestFilesExtension()) &&
    getSequence(uri.fsPath) != undefined &&
    collections.some((collection) =>
        uri.fsPath.includes(collection.rootDirectory)
    );
