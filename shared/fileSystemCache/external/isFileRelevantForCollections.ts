import { extname } from "path";
import {
    CollectionFormat,
    FeatureToggles,
    getFileExtensionForFormat,
    normalizePath,
} from "../..";

/**
 * Whether opening or editing the given file requires the collection cache (which is loaded lazily).
 *
 * Collection files can only exist within the workspace folders. JS files can also belong to a collection via its additional context roots
 * (which can be located outside the workspace folders), so they are relevant everywhere, except for dependencies in `node_modules` folders.
 */
export function isFileRelevantForCollections(
    filePath: string,
    workspaceFolders: string[],
    featureToggles: FeatureToggles,
) {
    const extension = extname(filePath);

    if (extension == ".js") {
        return !/(^|[\\/])node_modules[\\/]/.test(filePath);
    }

    const isCollectionFileExtension =
        extension == getFileExtensionForFormat(CollectionFormat.Bru) ||
        (featureToggles.yamlCollectionSupport &&
            extension == getFileExtensionForFormat(CollectionFormat.Yaml));

    return (
        isCollectionFileExtension &&
        workspaceFolders.some((folder) =>
            normalizePath(filePath).startsWith(normalizePath(folder)),
        )
    );
}
