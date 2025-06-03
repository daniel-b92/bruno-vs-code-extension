import { Uri, workspace } from "vscode";
import { Block, Collection, normalizeDirectoryPath } from "../../../../shared";
import { TemporaryJsFilesRegistry } from "../temporaryJsFilesRegistry";
import { createTemporaryJsFile } from "./createTemporaryJsFile";
import { getTemporaryJsFileName } from "./getTemporaryJsFileName";
import { isTempJsFileInSync } from "./isTempJsFileInSync";

export async function waitForTempJsFileToBeInSync(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collection: Collection,
    bruFileContent: string,
    bruFileCodeBlocks: Block[]
) {
    createTemporaryJsFileIfNotAlreadyRegistered(
        tempJsFilesRegistry,
        collection,
        bruFileContent
    );

    const virtualJsFileUri = Uri.file(
        getTemporaryJsFileName(collection.getRootDirectory())
    );

    const temporaryJsDoc = await workspace.openTextDocument(virtualJsFileUri);

    // Sometimes it takes a short while until VS Code notices that the Javascript file has been modified externally
    if (!isTempJsFileInSync(temporaryJsDoc.getText(), bruFileCodeBlocks)) {
        await new Promise<void>((resolve) => {
            // ToDo: Find a way to dispose of the event listener after Promise has been fulfilled
            workspace.onDidChangeTextDocument((e) => {
                if (
                    e.document.uri.toString() == virtualJsFileUri.toString() &&
                    e.contentChanges.length > 0 &&
                    isTempJsFileInSync(
                        temporaryJsDoc.getText(),
                        bruFileCodeBlocks
                    )
                ) {
                    resolve();
                }
            });
        });
    }

    return temporaryJsDoc;
}

function createTemporaryJsFileIfNotAlreadyRegistered(
    tempJsFilesRegistry: TemporaryJsFilesRegistry,
    collection: Collection,
    bruFileContent: string
) {
    const isTempJsFileRegistered = tempJsFilesRegistry
        .getCollectionsWithRegisteredJsFiles()
        .some(
            (registered) =>
                normalizeDirectoryPath(registered) ==
                normalizeDirectoryPath(collection.getRootDirectory())
        );

    if (!isTempJsFileRegistered) {
        createTemporaryJsFile(
            collection.getRootDirectory(),
            tempJsFilesRegistry,
            bruFileContent
        );
    }
}
