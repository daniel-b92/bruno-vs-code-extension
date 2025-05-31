import { normalizeDirectoryPath } from "../../../shared";
import { getTemporaryJsFileName } from "./codeBlocksUtils/getTemporaryJsFileName";

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
                    normalizeDirectoryPath(registeredCollection) ==
                        normalizeDirectoryPath(collectionRootDirectory) &&
                    registeredFile == filePath
            )
        ) {
            this.jsFiles.push({
                collectionRootDirectory,
                file: filePath,
            });
        }
    }

    public unregisterJsFileForCollection(collectionRootDirectory: string) {
        const index = this.jsFiles.findIndex(
            ({ collectionRootDirectory: registeredCollection }) =>
                normalizeDirectoryPath(registeredCollection) ==
                normalizeDirectoryPath(collectionRootDirectory)
        );

        if (index >= 0) {
            this.jsFiles.splice(index, 1);
        } else {
            console.warn(
                `Temporary js file for collection '${collectionRootDirectory}' that should be unregistered is not registered.`
            );
        }
    }

    public getCollectionsWithRegisteredJsFiles() {
        return this.jsFiles.map(
            ({ collectionRootDirectory }) => collectionRootDirectory
        );
    }

    public dispose() {
        this.jsFiles.splice(0, this.jsFiles.length);
    }
}
