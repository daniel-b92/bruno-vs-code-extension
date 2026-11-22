import { describe, it, expect, jest } from "@jest/globals";
import { BrunoTreeItem, TypedCollectionItemProvider } from "@shared";
import { BrunoTreeItemProvider } from "./brunoTreeItemProvider";
import { ContextRootItemProvider } from "./contextRoots/contextRootItemProvider";
import { ContextRootTreeItem } from "./contextRoots/contextRootTreeItem";

describe("BrunoTreeItemProvider", () => {
    describe("getChildren", () => {
        it("shows the context roots after the collections", async () => {
            const { provider } = createProvider({
                collectionRoots: ["/ws/b-collection", "/ws/a-collection"],
                contextRoots: ["/ws/a-shared", "/other/z-shared"],
            });

            const items = await provider.getChildren();

            expect(items.map((item) => item.getPath())).toEqual([
                "/ws/a-collection",
                "/ws/b-collection",
                "/ws/a-shared",
                "/other/z-shared",
            ]);
        });

        it("delegates to the context root provider for the items of a context root", async () => {
            const { provider, contextRootProvider } = createProvider({
                collectionRoots: [],
                contextRoots: ["/ws/shared"],
            });
            const folder = new ContextRootTreeItem("/ws/shared/sub", false);
            const child = new ContextRootTreeItem("/ws/shared/sub/a.js", true);
            contextRootProvider.getChildren.mockResolvedValue([child]);

            expect(await provider.getChildren(folder)).toEqual([child]);
            expect(contextRootProvider.getChildren).toHaveBeenCalledWith(
                folder,
            );
        });

        it("returns no children for a file of a context root", async () => {
            const { provider, contextRootProvider } = createProvider({
                collectionRoots: [],
                contextRoots: [],
            });

            const children = await provider.getChildren(
                new ContextRootTreeItem("/ws/shared/a.js", true),
            );

            expect(children).toEqual([]);
            expect(contextRootProvider.getChildren).not.toHaveBeenCalled();
        });
    });

    describe("getParent", () => {
        it("delegates to the context root provider for the items of a context root", () => {
            const { provider, contextRootProvider } = createProvider({
                collectionRoots: [],
                contextRoots: [],
            });
            const parent = new ContextRootTreeItem("/ws/shared", false);
            contextRootProvider.getParent.mockReturnValue(parent);

            expect(
                provider.getParent(
                    new ContextRootTreeItem("/ws/shared/a.js", true),
                ),
            ).toBe(parent);
        });

        it("does not throw for items that are not located in a collection", () => {
            const { provider } = createProvider({
                collectionRoots: [],
                contextRoots: [],
            });

            expect(
                provider.getParent({
                    getPath: () => "/not/in/a/collection/a.js",
                } as BrunoTreeItem),
            ).toBeUndefined();
        });
    });

    describe("change events", () => {
        it("refreshes the root level when the context roots of a collection changed", () => {
            const { provider, additionalContextRootListeners } = createProvider(
                { collectionRoots: [], contextRoots: [] },
            );
            const changes: (BrunoTreeItem | undefined)[] = [];
            provider.onDidChangeTreeData((item) => changes.push(item));

            additionalContextRootListeners.forEach((listener) => listener());

            expect(changes).toEqual([undefined]);
        });

        it("forwards the changes of the context root provider", () => {
            const { provider, contextRootListeners } = createProvider({
                collectionRoots: [],
                contextRoots: [],
            });
            const changes: (BrunoTreeItem | undefined)[] = [];
            provider.onDidChangeTreeData((item) => changes.push(item));
            const changedItem = new ContextRootTreeItem("/ws/shared", false);

            contextRootListeners.forEach((listener) => listener(changedItem));

            expect(changes).toEqual([changedItem]);
        });
    });
});

function createProvider({
    collectionRoots,
    contextRoots,
}: {
    collectionRoots: string[];
    contextRoots: string[];
}) {
    const additionalContextRootListeners: (() => void)[] = [];
    const contextRootListeners: ((item?: BrunoTreeItem) => void)[] = [];

    const collections = collectionRoots.map((rootDirectory) => ({
        getRootDirectory: () => rootDirectory,
        getStoredDataForPath: () => ({
            additionalData: {
                treeItem: new BrunoTreeItem(rootDirectory, false, true),
            },
        }),
    }));
    const itemProvider = {
        subscribeToUpdates: () => {},
        subscribeToAdditionalContextRootChanges: (listener: () => void) =>
            additionalContextRootListeners.push(listener),
        ensureCacheIsLoaded: () => Promise.resolve(),
        getRegisteredCollections: () => collections,
        getAncestorCollectionForPath: () => undefined,
    } as unknown as TypedCollectionItemProvider;
    const contextRootProvider = {
        onDidChange: (listener: (item?: BrunoTreeItem) => void) =>
            contextRootListeners.push(listener),
        getRootItems: jest.fn(() =>
            Promise.resolve(
                contextRoots.map(
                    (path) =>
                        new ContextRootTreeItem(path, false, {
                            description: path,
                            collectionNames: [],
                        }),
                ),
            ),
        ),
        getChildren: jest.fn<ContextRootItemProvider["getChildren"]>(),
        getParent: jest.fn<ContextRootItemProvider["getParent"]>(),
    };

    return {
        provider: new BrunoTreeItemProvider(
            "/ws",
            itemProvider,
            contextRootProvider as unknown as ContextRootItemProvider,
        ),
        contextRootProvider,
        additionalContextRootListeners,
        contextRootListeners,
    };
}
