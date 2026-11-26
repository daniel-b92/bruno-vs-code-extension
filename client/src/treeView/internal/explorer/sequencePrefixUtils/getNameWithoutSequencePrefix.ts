import { basename, extname } from "path";
import {
    CollectionItem,
    isCollectionItemWithSequence,
    removeSequencePrefix,
} from "@global_shared";
import { canNameHaveSequencePrefix } from "./canNameHaveSequencePrefix";
import { getStoredNameOfItem } from "./getStoredNameOfItem";

/** The name of the file (including its extension) or folder without its sequence prefix (if it has one, see `removeSequencePrefix`). */
export async function getNameWithoutSequencePrefix(item: CollectionItem) {
    const path = item.getPath();

    if (!canNameHaveSequencePrefix(item)) {
        return basename(path);
    }

    const extension = item.isFile() ? extname(path) : "";
    const nameWithoutPrefix = removeSequencePrefix(basename(path, extension), {
        sequence: isCollectionItemWithSequence(item)
            ? item.getSequence()
            : undefined,
        storedName: await getStoredNameOfItem(item),
    });

    return `${nameWithoutPrefix}${extension}`;
}
