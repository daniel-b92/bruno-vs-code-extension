import { Collection, isRequestFile } from "../..";

export function getDistinctTagsForCollection<T>(collection: Collection<T>) {
    const allTags = collection
        .getAllStoredDataForCollection()
        .map(({ item }) => item)
        .filter((item) => isRequestFile(item))
        .flatMap((item) => item.getTags())
        .filter((tag) => tag != undefined);

    return allTags.filter((tag, index) => allTags.indexOf(tag) == index);
}
