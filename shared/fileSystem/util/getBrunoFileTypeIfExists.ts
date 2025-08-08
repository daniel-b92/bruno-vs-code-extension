import { CollectionItemProvider } from "../../fileSystemCache/externalHelpers/collectionItemProvider";
import { isBrunoFileType } from "../../fileSystemCache/externalHelpers/isBrunoFileType";
import { BrunoFileType } from "../../model/brunoFileTypeEnum";
import { CollectionFile } from "../../model/collectionFile";
import { checkIfPathExistsAsync } from "./checkIfPathExistsAsync";

export async function getBrunoFileTypeIfExists(
    collectionItemProvider: CollectionItemProvider,
    filePath: string
) {
    const itemWithCollection =
        collectionItemProvider.getRegisteredItemAndCollection(filePath);

    return itemWithCollection &&
        (await checkIfPathExistsAsync(filePath)) &&
        itemWithCollection.data.item instanceof CollectionFile &&
        isBrunoFileType(itemWithCollection.data.item.getFileType())
        ? (itemWithCollection.data.item.getFileType() as BrunoFileType)
        : undefined;
}
