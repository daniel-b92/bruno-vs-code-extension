import {
    normalizePath,
    CollectionItem,
    isCollectionDirectory,
    isCollectionItemWithTags,
    CollectionItemProvider,
    ReadyOnlyCollection,
} from "../..";

export interface TagOccurences<T> {
    tag: string;
    pathsInOwnCollection: string[];
    inOtherCollections: {
        collection: ReadyOnlyCollection<T>;
        paths: string[];
    }[];
}

interface ItemIdentifier<T> {
    collection: ReadyOnlyCollection<T>;
    path: string;
}

export function getExistingTags<T>(
    itemProvider: CollectionItemProvider<T>,
    forOwnCollection: {
        collection: ReadyOnlyCollection<T>;
        pathToIgnore: string;
    },
): TagOccurences<T>[] {
    const {
        collection: ownCollection,
        pathToIgnore: toIgnoreForOwnCollection,
    } = forOwnCollection;

    const tagsForAllCollections = groupByTag(
        itemProvider.getRegisteredCollections().flatMap((collection) =>
            getTagsForCollection(
                collection,
                hasBaseDirectory(collection, ownCollection.getRootDirectory())
                    ? toIgnoreForOwnCollection
                    : undefined,
            ).map(({ tag, path }) => ({
                tag,
                itemIdentifier: { collection, path },
            })),
        ),
    );

    return tagsForAllCollections.map(({ tag, items }) => {
        const pathsInOwnCollection = items
            .filter(({ collection }) =>
                hasBaseDirectory(collection, ownCollection.getRootDirectory()),
            )
            .map(({ path }) => path);

        const inOtherCollections = groupByCollection(
            items.filter(
                ({ collection }) =>
                    !hasBaseDirectory(
                        collection,
                        ownCollection.getRootDirectory(),
                    ),
            ),
        );

        return { tag, pathsInOwnCollection, inOtherCollections };
    });
}

function getTagsForCollection<T>(
    collection: ReadyOnlyCollection<T>,
    pathToIgnore?: string,
) {
    return collection
        .getAllStoredDataForCollection()
        .flatMap(({ item }) => {
            const path = getTagDefinitionFilePath(item);
            const tags = isCollectionItemWithTags(item)
                ? item.getTags()
                : undefined;

            return path === undefined ||
                path == pathToIgnore ||
                !tags ||
                tags.length == 0
                ? []
                : {
                      path,
                      tags: tags.filter(
                          // filter out duplicate tags within same files
                          (tag, index) => tags.indexOf(tag) == index,
                      ),
                  };
        })
        .flatMap(({ path, tags }) => tags.map((tag) => ({ path, tag })));
}

function groupByTag<T>(
    tagsAndItems: {
        tag: string;
        itemIdentifier: ItemIdentifier<T>;
    }[],
) {
    return tagsAndItems.reduce(
        (prev, { itemIdentifier, tag: newTag }) => {
            const matchingTagIndex = prev.findIndex(({ tag }) => tag == newTag);

            if (matchingTagIndex < 0) {
                return prev.concat({
                    tag: newTag,
                    items: [itemIdentifier],
                });
            }

            return prev.map((val, index) =>
                index == matchingTagIndex
                    ? {
                          ...val,
                          items: val.items.concat(itemIdentifier),
                      }
                    : val,
            );
        },
        [] as {
            tag: string;
            items: ItemIdentifier<T>[];
        }[],
    );
}

function groupByCollection<T>(items: ItemIdentifier<T>[]) {
    return items.reduce(
        (prev, { collection, path }) => {
            const matchingCollectionIndex = prev.findIndex(
                ({ collection: c }) =>
                    hasBaseDirectory(c, collection.getRootDirectory()),
            );

            if (matchingCollectionIndex < 0) {
                return prev.concat({ collection, paths: [path] });
            }

            return prev.map((val, index) =>
                index == matchingCollectionIndex
                    ? {
                          ...val,
                          paths: val.paths.concat(path),
                      }
                    : val,
            );
        },
        [] as { collection: ReadyOnlyCollection<T>; paths: string[] }[],
    );
}

function hasBaseDirectory<T>(
    collection: ReadyOnlyCollection<T>,
    baseDirectory: string,
) {
    return (
        normalizePath(collection.getRootDirectory()) ==
        normalizePath(baseDirectory)
    );
}

/** The file in which the tags of the given item are defined (the settings file for directories). */
function getTagDefinitionFilePath(item: CollectionItem) {
    return isCollectionDirectory(item)
        ? item.getSettingsFilePath()
        : item.getPath();
}
