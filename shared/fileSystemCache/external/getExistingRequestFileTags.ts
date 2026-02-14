import {
    normalizeDirectoryPath,
    BrunoRequestFile,
    isRequestFile,
    Collection,
    CollectionItemProvider,
} from "../..";

export interface TagOccurences<T> {
    tag: string;
    pathsInOwnCollection: string[];
    inOtherCollections: { collection: Collection<T>; paths: string[] }[];
}

interface ItemIdentifier<T> {
    collection: Collection<T>;
    path: string;
}

export function getExistingRequestFileTags<T>(
    itemProvider: CollectionItemProvider<T>,
    forOwnCollection: {
        collection: Collection<T>;
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
    collection: Collection<T>,
    pathToIgnore?: string,
) {
    return collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                isRequestFile(item) &&
                item.getPath() != pathToIgnore &&
                item.getTags() &&
                (item.getTags() as string[]).length > 0,
        )
        .flatMap(({ item }) => {
            const tags = (item as BrunoRequestFile).getTags() as string[];

            return {
                path: item.getPath(),
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
        [] as { collection: Collection<T>; paths: string[] }[],
    );
}

function hasBaseDirectory<T>(collection: Collection<T>, baseDirectory: string) {
    return (
        normalizeDirectoryPath(collection.getRootDirectory()) ==
        normalizeDirectoryPath(baseDirectory)
    );
}
