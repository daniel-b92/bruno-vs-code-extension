import {
    BrunoRequestFile,
    Collection,
    isRequestFile,
} from "../../../../shared";

export function getExistingRequestFileTags(
    collection: Collection,
    pathToIgnore: string,
) {
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
