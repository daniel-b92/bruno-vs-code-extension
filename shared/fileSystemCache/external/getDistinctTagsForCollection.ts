import { isCollectionItemWithTags, ReadyOnlyCollection } from "../..";

export function getDistinctTagsForCollection<T>(
    collection: ReadyOnlyCollection<T>,
) {
    const allTags = collection
        .getAllStoredDataForCollection()
        .map(({ item }) => item)
        .filter((item) => isCollectionItemWithTags(item))
        .flatMap((item) => item.getTags())
        .filter((tag) => tag != undefined);

    return allTags.filter((tag, index) => allTags.indexOf(tag) == index);
}
