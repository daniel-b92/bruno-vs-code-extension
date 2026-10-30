import { dirname } from "path";
import * as ts from "typescript/lib/tsserverlibrary";
import {
    isPathWithinFolder,
    usesCaseSensitiveFileNames,
} from "../pathComparison";
import { CollectionFormat } from "../constants";
import {
    getCollectionRootFileCandidates,
    getFormatOfCollectionRootFile,
    isCollectionRootFileName,
} from "./collectionRootFiles";

interface Collection {
    format: CollectionFormat;
    rootFolder: string;
}

// The plugin can be created several times for the same project (see `index.ts`), each time with a different create info.
const lookupsForProjects = new WeakMap<
    ts.LanguageServiceHost,
    CollectionLookup
>();

export function getCollectionLookup(info: ts.server.PluginCreateInfo) {
    let lookup = lookupsForProjects.get(info.languageServiceHost);

    if (!lookup) {
        lookup = new CollectionLookup(info);
        lookupsForProjects.set(info.languageServiceHost, lookup);
    }

    return lookup;
}

export function disposeCollectionLookup(info: ts.server.PluginCreateInfo) {
    lookupsForProjects.get(info.languageServiceHost)?.dispose();
    lookupsForProjects.delete(info.languageServiceHost);
}

/**
 * Determining the collection for a file requires reading from the file system, but the collection is needed very often (e.g. for every module resolution).
 * So the collections are cached per directory.
 *
 * The root file of a collection (`bruno.json` / `opencollection.yml`) can be created, changed or deleted at any time (e.g. by hand or by a `git checkout`).
 * Therefore, all directories that were checked for a root file are watched (for new and deleted files)
 * and so are the files that could be root files (for changes of their content, e.g. when invalid content is fixed).
 * Listeners are notified, when such a file changes.
 */
export class CollectionLookup {
    private collectionsForDirectories = new Map<
        string,
        Collection | undefined
    >();
    private readonly directoryWatchers = new Map<string, ts.FileWatcher>();
    private readonly rootFileWatchers = new Map<string, ts.FileWatcher>();
    private readonly changeListeners: (() => void)[] = [];
    private readonly projectDirectory: string;

    constructor(private readonly info: ts.server.PluginCreateInfo) {
        this.projectDirectory = info.languageServiceHost.getCurrentDirectory();

        // Watching the whole project directory is cheaper than watching every directory with files individually.
        // The file system root can only be a project directory by accident, so it is not watched completely.
        if (dirname(this.projectDirectory) != this.projectDirectory) {
            this.watch(this.projectDirectory, true);
        }
    }

    getContainingCollection(fileName: string) {
        return this.getCollectionForDirectory(dirname(fileName));
    }

    /**
     * Determines the collections again for all directories that were looked up so far
     * (e.g. when a root file changed or when files were added to or removed from the project, in case a watcher missed a change).
     * Listeners are only notified if a collection actually changed, since that causes all files with code blocks to be parsed again.
     */
    refresh() {
        const previousCollections = this.collectionsForDirectories;
        this.collectionsForDirectories = new Map();

        const hasChanged = [...previousCollections].some(
            ([directory, previous]) => {
                const current = this.getCollectionForDirectory(directory);

                return (
                    previous?.rootFolder != current?.rootFolder ||
                    previous?.format != current?.format
                );
            },
        );

        if (hasChanged) {
            this.changeListeners.forEach((listener) => listener());
        }
    }

    onDidChange(listener: () => void) {
        this.changeListeners.push(listener);
    }

    dispose() {
        [
            ...this.directoryWatchers.values(),
            ...this.rootFileWatchers.values(),
        ].forEach((watcher) => watcher.close());
        this.directoryWatchers.clear();
        this.rootFileWatchers.clear();
        this.changeListeners.length = 0;
    }

    private getCollectionForDirectory(directory: string) {
        if (!this.collectionsForDirectories.has(directory)) {
            this.determineCollection(directory);
        }

        return this.collectionsForDirectories.get(directory);
    }

    private determineCollection(startDirectory: string) {
        const checkedDirectories: string[] = [];
        let currentDirectory = startDirectory;
        let collection: Collection | undefined;

        for (;;) {
            checkedDirectories.push(currentDirectory);
            this.watchIfNotCovered(currentDirectory);

            const rootFileCandidates = getCollectionRootFileCandidates(
                this.info,
                currentDirectory,
            );
            rootFileCandidates.forEach((fileName) =>
                this.watchRootFile(fileName),
            );

            const format = rootFileCandidates
                .map((fileName) =>
                    getFormatOfCollectionRootFile(this.info, fileName),
                )
                .find((candidateFormat) => candidateFormat != undefined);

            if (format) {
                collection = { format, rootFolder: currentDirectory };
                break;
            }

            const parentDirectory = dirname(currentDirectory);

            if (
                !this.info.serverHost.directoryExists(currentDirectory) ||
                parentDirectory == currentDirectory // dirname of a base folder in the file system seems to return the input folder again
            ) {
                break;
            }

            currentDirectory = parentDirectory;
        }

        // None of the directories on the way up contains a root file, so they all belong to the same collection (if any).
        checkedDirectories.forEach((directory) =>
            this.collectionsForDirectories.set(directory, collection),
        );
    }

    private watchIfNotCovered(directory: string) {
        const isCoveredByProjectDirectoryWatcher =
            this.directoryWatchers.has(this.projectDirectory) &&
            isPathWithinFolder(
                directory,
                this.projectDirectory,
                usesCaseSensitiveFileNames(this.info),
            );

        if (!isCoveredByProjectDirectoryWatcher) {
            this.watch(directory, false);
        }
    }

    private watch(directory: string, recursive: boolean) {
        if (
            this.directoryWatchers.has(directory) ||
            !this.info.serverHost.directoryExists(directory)
        ) {
            return;
        }

        this.startWatching(this.directoryWatchers, directory, (callback) =>
            this.info.serverHost.watchDirectory(
                directory,
                (changedPath) => {
                    if (isCollectionRootFileName(changedPath)) {
                        callback();
                    }
                },
                recursive,
            ),
        );
    }

    private watchRootFile(fileName: string) {
        if (this.rootFileWatchers.has(fileName)) {
            return;
        }

        this.startWatching(this.rootFileWatchers, fileName, (callback) =>
            this.info.serverHost.watchFile(fileName, callback),
        );
    }

    private startWatching(
        watchers: Map<string, ts.FileWatcher>,
        path: string,
        createWatcher: (onChange: () => void) => ts.FileWatcher,
    ) {
        try {
            watchers.set(
                path,
                createWatcher(() => this.refresh()),
            );
        } catch {
            // Watching can fail, e.g. if the file is deleted in the meantime. The collection is then only recomputed when the files of the project change.
        }
    }
}
