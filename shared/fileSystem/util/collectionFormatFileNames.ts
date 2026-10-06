import { CollectionFormat } from "../../baseModel/interfaces";

export function getFileExtensionForFormat(format: CollectionFormat) {
    return format == CollectionFormat.Yaml ? ".yml" : ".bru";
}

export function getCollectionRootFileName(format: CollectionFormat) {
    return format == CollectionFormat.Yaml
        ? "opencollection.yml"
        : "bruno.json";
}

export function getCollectionSettingsFileName(format: CollectionFormat) {
    return format == CollectionFormat.Yaml
        ? "opencollection.yml"
        : "collection.bru";
}

export function getFolderSettingsFileName(format: CollectionFormat) {
    return format == CollectionFormat.Yaml ? "folder.yml" : "folder.bru";
}
