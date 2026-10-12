import { DocumentSelector } from "vscode";
import {
    getFileExtensionForFormat,
    CollectionFormat,
    FeatureToggles,
} from "@global_shared";

export function getRequestFileDocumentSelector(
    featureToggles: FeatureToggles,
    formats: CollectionFormat[] = Object.values(CollectionFormat),
): DocumentSelector {
    return formats
        .filter(
            (format) =>
                format != CollectionFormat.Yaml ||
                featureToggles.yamlCollectionSupport,
        )
        .map((format) => ({
            scheme: "file",
            pattern: `**/*${getFileExtensionForFormat(format)}`,
        }));
}
