import { readdir, stat } from "fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "path";
import * as vscode from "vscode";
import {
    getPathsToIgnoreForCollections,
    isPathEqualOrDescendant,
    Logger,
    normalizePath,
} from "@global_shared";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import { ContextRootTreeItem } from "./contextRootTreeItem";
import { sortTreeItems } from "../sortTreeItems";

const hiddenFolderName = "node_modules";

/**
 * Provides the nodes for the additional context roots of the registered collections (folders with shared scripts outside of the collections) for the collection explorer.
 *
 * Their contents are read lazily from the file system when a node is expanded. Created and deleted items are detected with a file system watcher per shown root.
 */
export class ContextRootItemProvider implements vscode.Disposable {
    constructor(
        private itemProvider: TypedCollectionItemProvider,
        private workspaceRoot: string,
        private logger?: Logger,
        private debounceTimeInMs = 200,
    ) {}

    private changeEmitter = new vscode.EventEmitter<
        BrunoTreeItem | undefined
    >();

    /** Fires with the item whose children changed, or with `undefined` if the whole tree needs to be refreshed. */
    public readonly onDidChange = this.changeEmitter.event;

    /** VS Code needs the same instances for refreshing and revealing items, so the items are cached by their normalized path. */
    private itemsByPath = new Map<string, ContextRootTreeItem>();
    private rootsByPath = new Map<string, ContextRootTreeItem>();
    private watchersByRootPath = new Map<string, vscode.FileSystemWatcher>();
    /** Watch for the creation of the first missing folder on the way to configured roots that don't exist (yet), keyed by the normalized path of that folder. */
    private watchersForMissingRoots = new Map<
        string,
        vscode.FileSystemWatcher
    >();
    private needsRefreshOfRoots = false;
    private pendingEvents: { path: string; deleted: boolean }[] = [];
    private timerForPendingEvents: NodeJS.Timeout | undefined;

    public dispose() {
        clearTimeout(this.timerForPendingEvents);
        this.watchersByRootPath.forEach((watcher) => watcher.dispose());
        this.watchersByRootPath.clear();
        this.watchersForMissingRoots.forEach((watcher) => watcher.dispose());
        this.watchersForMissingRoots.clear();
        this.changeEmitter.dispose();
    }

    /**
     * Returns the top-level nodes (sorted by their label) for all configured context roots that exist.
     * Roots that are located within a collection, within another shown root or that don't exist (anymore) are left out.
     * The creation of roots that don't exist yet is watched, so that they are added to the tree once they exist.
     */
    public async getRootItems() {
        const { existingRoots, missingRoots } =
            await this.partitionConfiguredRoots();
        // Roots inside a collection are already visible there.
        const candidates = existingRoots.filter(
            (root) => !this.itemProvider.getAncestorCollectionForPath(root),
        );
        const rootPaths = candidates.filter(
            (root) =>
                // The contents are already visible within the other root.
                !candidates.some(
                    (other) =>
                        normalizePath(other) != normalizePath(root) &&
                        isPathEqualOrDescendant(root, other),
                ),
        );

        const items = rootPaths.map((rootPath) =>
            this.getOrCreateRootItem(rootPath),
        );

        this.rootsByPath = new Map(
            items.map((item) => [normalizePath(item.getPath()), item]),
        );
        this.syncWatchers(rootPaths);
        await this.syncWatchersForMissingRoots(
            missingRoots.filter(
                (root) => !this.itemProvider.getAncestorCollectionForPath(root),
            ),
        );

        return sortTreeItems(items);
    }

    /** Returns the sorted contents of the given folder (without the folders and files that are hidden in the explorer). */
    public async getChildren(folder: ContextRootTreeItem) {
        const entries = await readdir(folder.getPath(), {
            withFileTypes: true,
        }).catch((error) => {
            this.logger?.debug(
                `Could not read the contents of context root folder '${folder.getPath()}': ${error}`,
            );
            return [];
        });
        const registeredCollections =
            this.itemProvider.getRegisteredCollections();

        const children: ContextRootTreeItem[] = [];

        for (const entry of entries) {
            const path = join(folder.getPath(), entry.name);
            const isDirectory = entry.isSymbolicLink()
                ? await isDirectoryAfterFollowingLinks(path)
                : entry.isDirectory();

            if (
                entry.name == hiddenFolderName ||
                isIgnoredPath(path) ||
                // Collections within a context root are shown as collections.
                (isDirectory &&
                    registeredCollections.some((collection) =>
                        collection.isRootDirectory(path),
                    ))
            ) {
                continue;
            }

            children.push(this.getOrCreateItem(path, !isDirectory));
        }

        return sortTreeItems(children);
    }

    public getParent(item: ContextRootTreeItem) {
        return item.isTopLevel
            ? undefined
            : this.getOrCreateItem(dirname(item.getPath()), false);
    }

    /** Whether the path is the folder of a shown context root itself. */
    public isTopLevelContextRoot(path: string) {
        return this.rootsByPath.has(normalizePath(path));
    }

    /** Returns the top-level node of the shown context root that contains the path (or is the path). */
    public findContextRootForPath(path: string) {
        return [...this.rootsByPath.values()].find((root) =>
            isPathEqualOrDescendant(path, root.getPath()),
        );
    }

    /** Returns the node for the path, which is expected to be located in a shown context root. The node does not need to have been displayed before. */
    public getOrCreateItem(path: string, isFile: boolean) {
        const rootItem = this.rootsByPath.get(normalizePath(path));

        if (rootItem) {
            return rootItem;
        }

        const key = normalizePath(path);
        const existing = this.itemsByPath.get(key);

        if (existing && existing.isFile == isFile) {
            return existing;
        }

        const created = new ContextRootTreeItem(path, isFile);
        this.itemsByPath.set(key, created);

        return created;
    }

    private async partitionConfiguredRoots() {
        const existingRoots: string[] = [];
        const missingRoots: string[] = [];

        // Different spellings of the same path (e.g. with and without a trailing slash) are already returned only once.
        for (const root of this.itemProvider.getUniqueAdditionalContextRoots()) {
            if (await isDirectoryAfterFollowingLinks(root)) {
                existingRoots.push(root);
            } else {
                missingRoots.push(root);
                this.logger?.debug(
                    `Not showing additional context root '${root}' in the collection explorer, because it is not an existing directory.`,
                );
            }
        }

        return { existingRoots, missingRoots };
    }

    private getOrCreateRootItem(rootPath: string) {
        const key = normalizePath(rootPath);
        const details = {
            description: getDescriptionForRoot(rootPath, this.workspaceRoot),
            collectionNames: this.itemProvider
                .getCollectionsUsingAdditionalContextRoot(rootPath)
                .map((collection) => basename(collection.getRootDirectory())),
        };

        const existing = this.rootsByPath.get(key);

        if (existing) {
            existing.setRootDetails(details);
            return existing;
        }

        // The root nodes are only cached in `rootsByPath` (see `getRootItems`), so that no stale entry remains in `itemsByPath` when a root stops being a top-level node.
        return new ContextRootTreeItem(rootPath, false, details);
    }

    private syncWatchers(rootPaths: string[]) {
        const wantedKeys = new Set(rootPaths.map((p) => normalizePath(p)));

        for (const [key, watcher] of this.watchersByRootPath) {
            if (!wantedKeys.has(key)) {
                watcher.dispose();
                this.watchersByRootPath.delete(key);
                this.removeCachedItemsBelow(key);
            }
        }

        for (const rootPath of rootPaths) {
            const key = normalizePath(rootPath);

            if (this.watchersByRootPath.has(key)) {
                continue;
            }

            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(vscode.Uri.file(rootPath), "**/*"),
            );
            // Collections within a root are also watched by the file system cache, so their events reach both. That is harmless: The nodes within collections are never cached here, so only
            // the node of the folder that contains the collection (if it is cached) is refreshed, which is needed anyway for showing or hiding the collection.
            // Changes of the content of files don't matter for the tree.
            watcher.onDidCreate((uri) =>
                this.handleEvent(rootPath, uri.fsPath, false),
            );
            watcher.onDidDelete((uri) =>
                this.handleEvent(rootPath, uri.fsPath, true),
            );
            this.watchersByRootPath.set(key, watcher);
        }
    }

    private async syncWatchersForMissingRoots(missingRoots: string[]) {
        const wanted = new Map<string, { parent: string; missing: string }>();

        for (const root of missingRoots) {
            const target = await findFirstMissingFolder(root);

            if (target) {
                wanted.set(normalizePath(target.missing), target);
            }
        }

        for (const [key, watcher] of this.watchersForMissingRoots) {
            if (!wanted.has(key)) {
                watcher.dispose();
                this.watchersForMissingRoots.delete(key);
            }
        }

        for (const [key, { parent, missing }] of wanted) {
            if (this.watchersForMissingRoots.has(key)) {
                continue;
            }

            // Only the creation of this one folder is watched. Once it exists, the next missing folder (if any) is watched instead.
            const watcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(
                    vscode.Uri.file(parent),
                    basename(missing),
                ),
            );
            watcher.onDidCreate(() => {
                this.needsRefreshOfRoots = true;
                this.scheduleFlushOfPendingEvents();
            });
            this.watchersForMissingRoots.set(key, watcher);
        }
    }

    private handleEvent(rootPath: string, path: string, deleted: boolean) {
        if (
            relative(rootPath, path)
                .split(/[\\/]/)
                .includes(hiddenFolderName) ||
            isIgnoredPath(path)
        ) {
            return;
        }

        this.pendingEvents.push({ path, deleted });
        this.scheduleFlushOfPendingEvents();
    }

    private scheduleFlushOfPendingEvents() {
        // Batching avoids a refresh for every item when e.g. a folder with many files is copied.
        clearTimeout(this.timerForPendingEvents);
        this.timerForPendingEvents = setTimeout(
            () => this.flushPendingEvents(),
            this.debounceTimeInMs,
        );
    }

    private flushPendingEvents() {
        const events = this.pendingEvents.splice(0);
        const needsRefreshOfRoots = this.needsRefreshOfRoots;
        this.needsRefreshOfRoots = false;

        events
            .filter(({ deleted }) => deleted)
            .forEach(({ path }) =>
                this.removeCachedItemsBelow(normalizePath(path)),
            );

        if (
            needsRefreshOfRoots ||
            events.some(
                ({ path, deleted }) =>
                    deleted && this.rootsByPath.has(normalizePath(path)),
            )
        ) {
            // Roots may have to be added to or removed from the tree.
            this.changeEmitter.fire(undefined);
        }

        const parentsToRefresh = new Map<string, ContextRootTreeItem>();

        for (const { path } of events) {
            const key = normalizePath(dirname(path));
            const parent =
                this.rootsByPath.get(key) ?? this.itemsByPath.get(key);

            // Items that are not cached were not displayed yet, so there is nothing to refresh.
            if (parent) {
                parentsToRefresh.set(key, parent);
            }
        }

        this.logger?.debug(
            `[ContextRoots] Refreshing ${parentsToRefresh.size} items in the collection explorer after ${events.length} file system events.`,
        );

        parentsToRefresh.forEach((parent) => this.changeEmitter.fire(parent));
    }

    /** Removes the cached item for the path (given in normalized form) and the cached items below it. */
    private removeCachedItemsBelow(normalizedPath: string) {
        for (const key of [...this.itemsByPath.keys()]) {
            if (key.startsWith(normalizedPath)) {
                this.itemsByPath.delete(key);
            }
        }
    }
}

function getDescriptionForRoot(rootPath: string, workspaceRoot: string) {
    const relativeToWorkspace = relative(workspaceRoot, rootPath);

    return relativeToWorkspace.startsWith("..") ||
        isAbsolute(relativeToWorkspace)
        ? rootPath
        : relativeToWorkspace;
}

async function isDirectoryAfterFollowingLinks(path: string) {
    return (await stat(path).catch(() => undefined))?.isDirectory() === true;
}

function isIgnoredPath(path: string) {
    return getPathsToIgnoreForCollections().some((pattern) =>
        path.match(pattern),
    );
}

/**
 * Finds the first folder that is missing on the way to the given path, together with its parent folder (which exists).
 * Returns `undefined` if the folder can never be created, because a part of the path is a file.
 */
async function findFirstMissingFolder(path: string) {
    let missing = path;
    let parent = dirname(path);

    for (;;) {
        const stats = await stat(parent).catch(() => undefined);

        if (stats) {
            return stats.isDirectory() ? { parent, missing } : undefined;
        }

        if (dirname(parent) == parent) {
            return undefined;
        }

        missing = parent;
        parent = dirname(parent);
    }
}
