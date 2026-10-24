import { extname } from "path";
import {
    CollectionFormat,
    FeatureToggles,
    getFileExtensionForFormat,
} from "@global_shared";

/**
 * Whether opening or editing the given file requires the collection cache (which is loaded lazily).
 * Includes all JS files, since they can be part of a collection.
 */
export function isFileRelevantForCollections(
    filePath: string,
    featureToggles: FeatureToggles,
) {
    const extension = extname(filePath);

    return (
        extension == getFileExtensionForFormat(CollectionFormat.Bru) ||
        extension == ".js" ||
        (featureToggles.yamlCollectionSupport &&
            extension == getFileExtensionForFormat(CollectionFormat.Yaml))
    );
}
