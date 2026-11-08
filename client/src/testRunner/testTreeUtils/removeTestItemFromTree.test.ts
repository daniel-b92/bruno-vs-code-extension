import { describe, it, expect } from "@jest/globals";
import { TestController, TestItem, Uri } from "vscode";
import {
    BrunoRequestFile,
    Collection,
    CollectionDirectory,
    CollectionFormat,
    CollectionItem,
} from "@global_shared";
import { TypedCollection } from "@shared";
import { removeTestItemFromTree } from "./removeTestItemFromTree";

const root = "/collection";

describe("removeTestItemFromTree", () => {
    it("removes a deleted directory together with its descendants", () => {
        const { controller, collection, uriOf } = createTree([
            dir("/collection/folder"),
            file("/collection/folder/a.bru"),
            file("/collection/b.bru"),
        ]);
        // The cache has already dropped the deleted directory and everything in it
        collection.removeTestItemAndDescendants(dir("/collection/folder"));

        removeTestItemFromTree(
            controller,
            collection,
            uriOf("/collection/folder"),
        );

        expect(getTreePaths(controller)).toEqual([root, "/collection/b.bru"]);
    });

    it("removes the parent directory when its last test is removed", () => {
        const { controller, collection, uriOf } = createTree([
            dir("/collection/folder"),
            file("/collection/folder/a.bru"),
            file("/collection/b.bru"),
        ]);

        removeTestItemFromTree(
            controller,
            collection,
            uriOf("/collection/folder/a.bru"),
        );

        expect(getTreePaths(controller)).toEqual([root, "/collection/b.bru"]);
    });

    it("keeps the parent directory if other tests are left in it", () => {
        const { controller, collection, uriOf } = createTree([
            dir("/collection/folder"),
            file("/collection/folder/a.bru"),
            file("/collection/folder/b.bru"),
        ]);

        removeTestItemFromTree(
            controller,
            collection,
            uriOf("/collection/folder/a.bru"),
        );

        expect(getTreePaths(controller)).toEqual([
            root,
            "/collection/folder",
            "/collection/folder/b.bru",
        ]);
    });

    it("removes all ancestors that become empty, but not the collection root", () => {
        const { controller, collection, uriOf } = createTree([
            dir("/collection/outer"),
            dir("/collection/outer/inner"),
            file("/collection/outer/inner/a.bru"),
        ]);

        removeTestItemFromTree(
            controller,
            collection,
            uriOf("/collection/outer/inner/a.bru"),
        );

        expect(getTreePaths(controller)).toEqual([root]);
    });

    it("stops removing ancestors at the first one that still has other children", () => {
        const { controller, collection, uriOf } = createTree([
            dir("/collection/outer"),
            dir("/collection/outer/inner"),
            file("/collection/outer/inner/a.bru"),
            file("/collection/outer/b.bru"),
        ]);

        removeTestItemFromTree(
            controller,
            collection,
            uriOf("/collection/outer/inner/a.bru"),
        );

        expect(getTreePaths(controller)).toEqual([
            root,
            "/collection/outer",
            "/collection/outer/b.bru",
        ]);
    });

    it("removes a deleted collection root from the top level", () => {
        const { controller, collection, uriOf } = createTree([]);

        removeTestItemFromTree(controller, collection, uriOf(root));

        expect(getTreePaths(controller)).toEqual([]);
    });

    it("does nothing for an item that is not part of the tree", () => {
        const { controller, collection, uriOf } = createTree([
            file("/collection/b.bru"),
        ]);

        removeTestItemFromTree(
            controller,
            collection,
            uriOf("/collection/unknown/c.bru"),
        );

        expect(getTreePaths(controller)).toEqual([root, "/collection/b.bru"]);
    });
});

interface FakeTestItem {
    id: string;
    uri: { fsPath: string };
    children: FakeItemCollection;
}

/** Minimal stand-in for the parts of `TestItemCollection` that are used for removing items from the tree. */
class FakeItemCollection {
    private items = new Map<string, FakeTestItem>();

    get size() {
        return this.items.size;
    }

    add(item: FakeTestItem) {
        this.items.set(item.id, item);
    }

    delete(id: string) {
        this.items.delete(id);
    }

    get(id: string) {
        return this.items.get(id);
    }

    values() {
        return Array.from(this.items.values());
    }
}

function dir(path: string) {
    return new CollectionDirectory(path);
}

function file(path: string) {
    return new BrunoRequestFile(path, 1);
}

/**
 * Creates a collection with the given items (in addition to the root directory) and a test tree that contains all of them.
 * The test items are linked to their parents like the test runner does it.
 */
function createTree(items: CollectionItem[]) {
    const collection = new Collection<{ testItem: TestItem }>(
        new CollectionDirectory(root),
        { testItem: createTestItem(root) },
        [],
        CollectionFormat.Bru,
    );
    const controller = { items: new FakeItemCollection() };

    items.forEach((item) =>
        collection.addItem({
            item,
            additionalData: { testItem: createTestItem(item.getPath()) },
        }),
    );
    controller.items.add(getTestItem(collection, root));

    for (const item of items) {
        const parentPath = item.getPath().replace(/\/[^/]+$/, "");
        getTestItem(collection, parentPath).children.add(
            getTestItem(collection, item.getPath()),
        );
    }

    return {
        controller: controller as unknown as TestController,
        collection: collection as unknown as TypedCollection &
            Collection<{ testItem: TestItem }>,
        uriOf: (path: string) => createUri(path) as unknown as Uri,
    };
}

function getTestItem(
    collection: Collection<{ testItem: TestItem }>,
    path: string,
) {
    return (
        collection.getStoredDataForPath(path) as unknown as {
            additionalData: { testItem: FakeTestItem };
        }
    ).additionalData.testItem;
}

function createTestItem(path: string) {
    const uri = createUri(path);

    return {
        id: uri.toString(),
        uri,
        children: new FakeItemCollection(),
    } as unknown as TestItem;
}

function createUri(path: string) {
    return { fsPath: path, toString: () => `file://${path}` };
}

/** Returns the paths of all items in the tree (depth first). */
function getTreePaths(controller: TestController) {
    const collect = (items: FakeItemCollection): string[] =>
        items
            .values()
            .flatMap((item) => [item.uri.fsPath, ...collect(item.children)]);

    return collect(controller.items as unknown as FakeItemCollection);
}
