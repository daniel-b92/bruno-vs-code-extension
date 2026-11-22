import { describe, it, expect, jest, afterEach } from "@jest/globals";
import { join } from "path";
import { workspace } from "vscode";
import { CollectionFormat, isPathEqualOrDescendant } from "@global_shared";
import {
    createCollectionWithEnvironments,
    useTemporaryDirectories,
    waitUntil,
} from "@global_shared/_testingUtils";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import { ContextRootItemProvider } from "./contextRootItemProvider";

describe("ContextRootItemProvider", () => {
    const createTemporaryDirectory = useTemporaryDirectories();
    const providers: ContextRootItemProvider[] = [];

    afterEach(() => {
        providers.splice(0).forEach((provider) => provider.dispose());
        jest.restoreAllMocks();
    });

    describe("getRootItems", () => {
        it("shows equal roots with different spellings only once", async () => {
            const base = await createTemporaryDirectory({
                "shared/a.js": "",
            });
            const shared = join(base, "shared");
            const provider = createProvider(base, [
                { name: "first", roots: [shared] },
                { name: "second", roots: [`${shared}/`] },
            ]);

            const items = await provider.getRootItems();

            expect(items.map((item) => item.label)).toEqual(["shared"]);
        });

        it("leaves out roots inside a collection, roots in other roots and roots that are no existing directories", async () => {
            const base = await createTemporaryDirectory({
                "collection/inside/a.js": "",
                "shared/nested/a.js": "",
                "file.js": "",
            });
            const provider = createProvider(base, [
                {
                    name: "collection",
                    rootDirectory: join(base, "collection"),
                    roots: [
                        join(base, "collection", "inside"),
                        join(base, "shared", "nested"),
                        join(base, "shared"),
                        join(base, "missing"),
                        join(base, "file.js"),
                    ],
                },
            ]);

            const items = await provider.getRootItems();

            expect(items.map((item) => item.getPath())).toEqual([
                join(base, "shared"),
            ]);
        });

        it("sorts the roots alphabetically", async () => {
            const base = await createTemporaryDirectory({
                "b/a.js": "",
                "A/a.js": "",
                "c/a.js": "",
            });
            const provider = createProvider(base, [
                {
                    name: "collection",
                    roots: [join(base, "c"), join(base, "b"), join(base, "A")],
                },
            ]);

            const items = await provider.getRootItems();

            expect(items.map((item) => item.label)).toEqual(["A", "b", "c"]);
        });

        it("describes roots relative to the workspace, or with the absolute path outside of it", async () => {
            const base = await createTemporaryDirectory({
                "ws/shared/a.js": "",
                "other/b.js": "",
            });
            const provider = createProvider(
                join(base, "ws"),
                [
                    {
                        name: "collection",
                        roots: [
                            join(base, "ws", "shared"),
                            join(base, "other"),
                        ],
                    },
                ],
                base,
            );

            const items = await provider.getRootItems();

            expect(items.map((item) => item.description)).toEqual([
                join(base, "other"),
                "shared",
            ]);
        });

        it("names the collections that use the root in its tooltip", async () => {
            const base = await createTemporaryDirectory({
                "shared/a.js": "",
            });
            const shared = join(base, "shared");
            const provider = createProvider(base, [
                { name: "first", roots: [shared] },
                { name: "second", roots: [shared] },
                { name: "third", roots: [] },
            ]);

            const [item] = await provider.getRootItems();

            expect((item.tooltip as { value: string }).value).toContain(
                "'first', 'second'",
            );
        });

        it("returns the same instances for repeated calls", async () => {
            const base = await createTemporaryDirectory({ "shared/a.js": "" });
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);

            const [first] = await provider.getRootItems();
            const [second] = await provider.getRootItems();

            expect(second).toBe(first);
        });
    });

    describe("getChildren", () => {
        it("lists folders first and then files alphabetically", async () => {
            const base = await createTemporaryDirectory({
                "shared/b.js": "",
                "shared/A.js": "",
                "shared/z/x.js": "",
                "shared/m/x.js": "",
            });
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);
            const [root] = await provider.getRootItems();

            const children = await provider.getChildren(root);

            expect(children.map((child) => child.label)).toEqual([
                "m",
                "z",
                "A.js",
                "b.js",
            ]);
            expect(children.map((child) => child.contextValue)).toEqual([
                "contextRootFolder",
                "contextRootFolder",
                "contextRootFile",
                "contextRootFile",
            ]);
        });

        it("hides node_modules, ignored files and folders that are collections", async () => {
            const base = await createTemporaryDirectory({
                "shared/node_modules/a.js": "",
                "shared/nested/a.js": "",
                "shared/kept/a.js": "",
                "shared/kept.js": "",
            });
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
                {
                    name: "nested",
                    roots: [],
                    rootDirectory: join(base, "shared", "nested"),
                },
            ]);
            const [root] = await provider.getRootItems();

            const children = await provider.getChildren(root);

            expect(children.map((child) => child.label)).toEqual([
                "kept",
                "kept.js",
            ]);
        });

        it("returns no children for folders that do not exist anymore", async () => {
            const base = await createTemporaryDirectory({ "shared/a.js": "" });
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);
            await provider.getRootItems();
            const missing = provider.getOrCreateItem(
                join(base, "shared", "missing"),
                false,
            );

            expect(await provider.getChildren(missing)).toEqual([]);
        });

        it("returns the same instances as getOrCreateItem and a matching parent", async () => {
            const base = await createTemporaryDirectory({
                "shared/sub/a.js": "",
            });
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);
            const [root] = await provider.getRootItems();
            const [folder] = await provider.getChildren(root);
            const [file] = await provider.getChildren(folder);

            expect(provider.getOrCreateItem(file.getPath(), true)).toBe(file);
            expect(provider.getParent(file)).toBe(folder);
            expect(provider.getParent(folder)).toBe(root);
            expect(provider.getParent(root)).toBeUndefined();
        });
    });

    describe("finding items", () => {
        it("finds the shown root that contains a path, but not roots with a similar name", async () => {
            const base = await createTemporaryDirectory({
                "shared/a.js": "",
                "shared-other/a.js": "",
            });
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);
            const [root] = await provider.getRootItems();

            expect(
                provider.findContextRootForPath(
                    join(base, "shared", "x", "a.js"),
                ),
            ).toBe(root);
            expect(
                provider.findContextRootForPath(
                    join(base, "shared-other", "a.js"),
                ),
            ).toBeUndefined();
            expect(provider.isTopLevelContextRoot(join(base, "shared"))).toBe(
                true,
            );
            expect(
                provider.isTopLevelContextRoot(join(base, "shared", "x")),
            ).toBe(false);
        });
    });

    describe("file system events", () => {
        it("fires a change for the cached parent item when an item was created", async () => {
            const base = await createTemporaryDirectory({
                "shared/sub/a.js": "",
            });
            const watchers = mockFileSystemWatchers();
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);
            const [root] = await provider.getRootItems();
            const [folder] = await provider.getChildren(root);
            const changes = collectChanges(provider);

            // Both items are in the same batch.
            watchers.create(join(base, "shared", "sub", "b.js"));
            watchers.create(join(base, "shared", "c.js"));

            await waitUntil(() => changes.length == 2);
            expect(changes).toContain(root);
            expect(changes).toContain(folder);
        });

        it("removes deleted items from the cache", async () => {
            const base = await createTemporaryDirectory({
                "shared/sub/a.js": "",
            });
            const watchers = mockFileSystemWatchers();
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);
            const [root] = await provider.getRootItems();
            const [folder] = await provider.getChildren(root);
            const [file] = await provider.getChildren(folder);
            const changes = collectChanges(provider);

            watchers.delete(folder.getPath());
            watchers.delete(file.getPath());

            await waitUntil(() => changes.length > 0);
            // The folder is not cached anymore, so there is no need to refresh it.
            expect(changes).toEqual([root]);
            expect(provider.getOrCreateItem(folder.getPath(), false)).not.toBe(
                folder,
            );
            expect(provider.getOrCreateItem(file.getPath(), true)).not.toBe(
                file,
            );
        });

        it("ignores events within node_modules", async () => {
            const base = await createTemporaryDirectory({ "shared/a.js": "" });
            const watchers = mockFileSystemWatchers();
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);
            await provider.getRootItems();
            const changes = collectChanges(provider);

            watchers.create(join(base, "shared", "node_modules", "a.js"));
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(changes).toEqual([]);
        });

        it("refreshes the whole tree when a root was deleted", async () => {
            const base = await createTemporaryDirectory({ "shared/a.js": "" });
            const watchers = mockFileSystemWatchers();
            const provider = createProvider(base, [
                { name: "first", roots: [join(base, "shared")] },
            ]);
            await provider.getRootItems();
            const changes = collectChanges(provider);

            watchers.delete(join(base, "shared"));

            await waitUntil(() => changes.length > 0);
            expect(changes).toEqual([undefined]);
        });

        it("watches each shown root once and disposes the watchers of roots that are not shown anymore", async () => {
            const base = await createTemporaryDirectory({
                "a/x.js": "",
                "b/x.js": "",
            });
            const watchers = mockFileSystemWatchers();
            const roots = [join(base, "a"), join(base, "b")];
            const collection = createCollection("first", base);
            collection.setAdditionalContextRoots(roots);
            const provider = createProvider(base, [], undefined, [collection]);

            await provider.getRootItems();
            await provider.getRootItems();
            collection.setAdditionalContextRoots([roots[0]]);
            await provider.getRootItems();

            expect(watchers.createdWatchers).toBe(2);
            expect(watchers.disposedWatchers).toBe(1);
        });
    });

    function createProvider(
        workspaceRoot: string,
        collectionData: {
            name: string;
            roots: string[];
            rootDirectory?: string;
        }[],
        collectionsParent = workspaceRoot,
        collections = collectionData.map(({ name, roots, rootDirectory }) => {
            const collection = createCollection(
                name,
                collectionsParent,
                rootDirectory,
            );
            collection.setAdditionalContextRoots(roots);
            return collection;
        }),
    ) {
        const provider = new ContextRootItemProvider(
            createItemProvider(collections),
            workspaceRoot,
            undefined,
            0,
        );
        providers.push(provider);

        return provider;
    }
});

function createCollection(
    name: string,
    parentDirectory: string,
    rootDirectory = join(parentDirectory, "collections", name),
) {
    return createCollectionWithEnvironments(
        [],
        CollectionFormat.Bru,
        rootDirectory,
    );
}

function createItemProvider(
    collections: ReturnType<typeof createCollection>[],
) {
    return {
        getRegisteredCollections: () => collections,
        getUniqueAdditionalContextRoots: () =>
            collections
                .flatMap((collection) => collection.getAdditionalContextRoots())
                .filter((path, index, all) => all.indexOf(path) === index),
        getAncestorCollectionForPath: (path: string) =>
            collections.find((collection) =>
                isPathEqualOrDescendant(path, collection.getRootDirectory()),
            ),
    } as unknown as TypedCollectionItemProvider;
}

function collectChanges(provider: ContextRootItemProvider) {
    const changes: (BrunoTreeItem | undefined)[] = [];
    provider.onDidChange((item) => changes.push(item));

    return changes;
}

/** Replaces the watchers of the workspace, so that tests can trigger their events. */
function mockFileSystemWatchers() {
    const createListeners: ((uri: { fsPath: string }) => void)[] = [];
    const deleteListeners: ((uri: { fsPath: string }) => void)[] = [];
    const result = {
        createdWatchers: 0,
        disposedWatchers: 0,
        create: (path: string) =>
            createListeners.forEach((listener) => listener({ fsPath: path })),
        delete: (path: string) =>
            deleteListeners.forEach((listener) => listener({ fsPath: path })),
    };

    jest.spyOn(workspace, "createFileSystemWatcher").mockImplementation(() => {
        result.createdWatchers++;

        return {
            onDidCreate: (listener: (uri: { fsPath: string }) => void) => {
                createListeners.push(listener);
                return { dispose: () => {} };
            },
            onDidDelete: (listener: (uri: { fsPath: string }) => void) => {
                deleteListeners.push(listener);
                return { dispose: () => {} };
            },
            onDidChange: () => ({ dispose: () => {} }),
            dispose: () => result.disposedWatchers++,
        } as never;
    });

    return result;
}
