import { DocumentSelector } from "vscode";
import {
    getFileExtensionForFormat,
    CollectionFormat,
    FeatureToggles,
} from "@global_shared";

export function getRequestFileDocumentSelector(
    featureToggles: FeatureToggles,
): DocumentSelector {
    return [
        CollectionFormat.Bru,
        ...(featureToggles.yamlCollectionSupport
            ? [CollectionFormat.Yaml]
            : []),
    ].map((format) => ({
        scheme: "file",
        pattern: `**/*${getFileExtensionForFormat(format)}`,
    }));
}
