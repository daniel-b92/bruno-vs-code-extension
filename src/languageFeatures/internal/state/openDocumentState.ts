import { basename, dirname, extname } from "path";
import { Uri } from "vscode";
import { Collection, normalizeDirectoryPath } from "../../../shared";
import { existsSync } from "fs";

export class OpenDocumentState {
    private isRequestFile = true;

    public async isDocumentBrunoRequestFile(
        currentCollections: readonly Collection[],
        uri: Uri
    ) {
        const path = uri.fsPath;

        if (!existsSync(path)) {
            this.isRequestFile = false;
            return false;
        }

        const isBrunoRequestFile =
            extname(path) == ".bru" &&
            !dirname(path).match(/environments(\/|\\)?/) &&
            basename(path) != "folder.bru" &&
            (basename(path) != "collection.bru" ||
                currentCollections.every(
                    (collection) =>
                        normalizeDirectoryPath(collection.getRootDirectory()) !=
                        normalizeDirectoryPath(dirname(path))
                ));

        this.isRequestFile = isBrunoRequestFile;

        return isBrunoRequestFile;
    }

    public isCurrentDocumentRequestFile() {
        return this.isRequestFile;
    }
}
