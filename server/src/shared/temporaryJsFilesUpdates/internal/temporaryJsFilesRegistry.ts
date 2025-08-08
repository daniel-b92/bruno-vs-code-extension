import {
    getTemporaryJsFileName,
    normalizeDirectoryPath,
} from "../../../../../shared";

export class TemporaryJsFilesRegistry {
    constructor() {}

    private jsFiles: {
        collectionRootDirectory: string;
        file: string;
    }[] = [];

    public registerJsFile(collectionRootDirectory: string) {
        const filePath = getTemporaryJsFileName(collectionRootDirectory);

        if (
            !this.jsFiles.some(
                ({
                    collectionRootDirectory: registeredCollection,
                    file: registeredFile,
                }) =>
                    this.getRegisteredFileForCollection(registeredCollection) &&
                    registeredFile == filePath,
            )
        ) {
            this.jsFiles.push({
                collectionRootDirectory,
                file: filePath,
            });
        }
    }

    public unregisterJsFileForCollection(collectionRootDirectory: string) {
        const maybeRegisteredFile = this.getRegisteredFileForCollection(
            collectionRootDirectory,
        );

        if (maybeRegisteredFile) {
            this.jsFiles.splice(maybeRegisteredFile.index, 1);
        }
    }

    public dispose() {
        this.jsFiles.splice(0, this.jsFiles.length);
    }

    private getRegisteredFileForCollection(collectionRootDirectory: string) {
        const index = this.jsFiles.findIndex(
            ({ collectionRootDirectory: registeredCollection }) =>
                normalizeDirectoryPath(registeredCollection) ==
                normalizeDirectoryPath(collectionRootDirectory),
        );

        if (index >= 0) {
            return { file: this.jsFiles[index].file, index };
        } else {
            return undefined;
        }
    }
}
