import { dirname } from "path";
import { ItemType, normalizePath } from "@global_shared";
import { TypedCollectionItemProvider } from "@shared";
import { getFolderWithItemsAffectedByFile } from "./getFolderWithItemsAffectedByFile";

/** The folders whose direct child items may have to be renamed (see `syncSequencePrefixes`) if a file is copied or moved. */
export function getFoldersAffectedByFileInsertion(
    itemProvider: TypedCollectionItemProvider,
    { sourcePath, newPath }: { sourcePath: string; newPath: string },
    fileType: ItemType,
): string[] {
    const [targetFolder, sourceFolder] = [newPath, sourcePath].map((path) =>
        getFolderWithItemsAffectedByFile(itemProvider, path, fileType),
    );
    // The other requests and app files next to the source may be renumbered.
    // A folder keeps its name if its settings file is copied or moved to another place, since it has the same sequence or none at all then.
    const isSourceFolderAffected =
        sourceFolder != undefined &&
        normalizePath(sourceFolder) == normalizePath(dirname(sourcePath));

    return [
        targetFolder,
        isSourceFolderAffected ? sourceFolder : undefined,
    ].filter((folder) => folder != undefined);
}
