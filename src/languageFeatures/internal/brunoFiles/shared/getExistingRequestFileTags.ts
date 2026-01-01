import {
    BrunoRequestFile,
    Collection,
    CollectionItemProvider,
    isRequestFile,
    normalizeDirectoryPath,
} from "../../../../shared";

export interface TagOccurences {
    tag: string;
    pathsInOwnCollection: string[];
    inOtherCollections: { collection: Collection; paths: string[] }[];
}

export function getExistingRequestFileTags(
    itemProvider: CollectionItemProvider,
    forOwnCollection: {
        collection: Collection;
        pathToIgnore: string;
    },
): TagOccurences[] {
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
            ).map(({ tag, itemIdentifier: identifierPath }) => ({
                tag,
                itemIdentifier: { ...identifierPath, collection },
            })),
        ),
    );

    return tagsForAllCollections.map(({ tag, items }) => {
        const pathsInOwnCollection = items
            .filter(({ collection }) =>
                hasBaseDirectory(collection, ownCollection.getRootDirectory()),
            )
            .map(({ path }) => path);

        const inOtherCollections = items
            .filter(
                ({ collection }) =>
                    !hasBaseDirectory(
                        collection,
                        ownCollection.getRootDirectory(),
                    ),
            )
            .reduce(
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
                [] as { collection: Collection; paths: string[] }[],
            );

        return { tag, pathsInOwnCollection, inOtherCollections };
    });
}

function getTagsForCollection(collection: Collection, pathToIgnore?: string) {
    const tagsPerPath = collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                isRequestFile(item) &&
                item.getPath() != pathToIgnore &&
                item.getTags() &&
                (item.getTags() as string[]).length > 0,
        )
        .flatMap(({ item }) => ({
            path: item.getPath(),
            tags: (item as BrunoRequestFile).getTags() as string[],
        }));

    return tagsPerPath
        .filter(
            // filter out duplicate tags within same files
            (tag, index) => tagsPerPath.indexOf(tag) == index,
        )
        .flatMap(({ path, tags }) =>
            tags.map((tag) => ({ itemIdentifier: { path }, tag })),
        );
}

function groupByTag(
    tagsAndPaths: {
        tag: string;
        itemIdentifier: {
            collection: Collection;
            path: string;
        };
    }[],
) {
    return tagsAndPaths.reduce(
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
            items: {
                collection: Collection;
                path: string;
            }[];
        }[],
    );
}

function hasBaseDirectory(collection: Collection, baseDirectory: string) {
    return (
        normalizeDirectoryPath(collection.getRootDirectory()) ==
        normalizeDirectoryPath(baseDirectory)
    );
}
