import {
    BrunoRequestFile,
    Collection,
    CollectionItemProvider,
    isRequestFile,
    normalizeDirectoryPath,
} from "../../../../shared";

interface OccurencesGroupedByTag {
    tag: string;
    inOwnCollection: boolean;
    inOtherCollections: Collection[];
}

export function getExistingRequestFileTags(
    itemProvider: CollectionItemProvider,
    forOwnCollection: {
        collection: Collection;
        pathToIgnore: string;
    },
): OccurencesGroupedByTag[] {
    const {
        collection: ownCollection,
        pathToIgnore: toIgnoreForOwnCollection,
    } = forOwnCollection;

    const tagsForOwnCollection = getTagsForCollection(
        ownCollection,
        toIgnoreForOwnCollection,
    );

    const tagsForOtherCollections = itemProvider
        .getRegisteredCollections()
        .filter((c) => !hasBaseDirectory(c, ownCollection.getRootDirectory()))
        .flatMap((c) =>
            getTagsForCollection(c).map((tag) => ({
                collection: c,
                tag,
            })),
        );

    return groupByTag(
        tagsForOwnCollection.map((tag) => ({ collection: ownCollection, tag })),
        true,
    ).concat(groupByTag(tagsForOtherCollections, false));
}

function groupByTag(
    tagWithCollection: { collection: Collection; tag: string }[],
    inOwnCollectionResultValue: boolean,
): OccurencesGroupedByTag[] {
    return tagWithCollection.reduce(
        (prev, { collection: c, tag }) => {
            const matchingTagIndex = prev.findIndex(({ tag: t }) => t == tag);

            if (matchingTagIndex < 0) {
                return prev.concat({
                    tag,
                    inOwnCollection: inOwnCollectionResultValue,
                    inOtherCollections: [c],
                });
            }

            const oldEntry = prev[matchingTagIndex];
            return [
                ...prev.filter((_, index) => index != matchingTagIndex),
                {
                    ...oldEntry,
                    inOtherCollections: [...oldEntry.inOtherCollections, c],
                },
            ];
        },
        [] as {
            tag: string;
            inOwnCollection: boolean;
            inOtherCollections: Collection[];
        }[],
    );
}

function getTagsForCollection(collection: Collection, pathToIgnore?: string) {
    const allExistingTags = collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                isRequestFile(item) &&
                item.getPath() != pathToIgnore &&
                item.getTags() &&
                (item.getTags() as string[]).length > 0,
        )
        .flatMap(
            ({ item }) => (item as BrunoRequestFile).getTags() as string[],
        );

    return allExistingTags.filter(
        // filter out duplicate entries
        (tag, index) => allExistingTags.indexOf(tag) == index,
    );
}

function hasBaseDirectory(collection: Collection, baseDirectory: string) {
    return (
        normalizeDirectoryPath(collection.getRootDirectory()) ==
        normalizeDirectoryPath(baseDirectory)
    );
}
