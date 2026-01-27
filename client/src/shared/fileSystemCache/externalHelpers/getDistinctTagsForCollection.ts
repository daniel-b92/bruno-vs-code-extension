import { isRequestFile } from "../..";
import { Collection } from "../../model/collection";

export function getDistinctTagsForCollection(collection: Collection) {
    const allTags = collection
        .getAllStoredDataForCollection()
        .map(({ item }) => item)
        .filter((item) => isRequestFile(item))
        .flatMap((item) => item.getTags())
        .filter((tag) => tag != undefined);

    return allTags.filter((tag, index) => allTags.indexOf(tag) == index);
}
