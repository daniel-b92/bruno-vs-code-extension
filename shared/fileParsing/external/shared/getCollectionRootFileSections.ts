import { parseCollectionSettingsFile, TextDocumentHelper } from "../../..";

/**
 * Returns the object that is stored under the given key in a `bruno.json`, if the file is valid JSON and the value is an object.
 */
export function getBrunoJsonSection(
    fileContent: string,
    key: string,
): Record<string, unknown> | undefined {
    try {
        const parsed = JSON.parse(fileContent) as unknown;

        if (typeof parsed != "object" || parsed == null || !(key in parsed)) {
            return undefined;
        }

        const section = (parsed as Record<string, unknown>)[key];

        return typeof section == "object" && section != null
            ? (section as Record<string, unknown>)
            : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Returns the properties of the `extensions.bruno` section of an `opencollection.yml`.
 */
export function getYamlBrunoExtension(fileContent: string) {
    return parseCollectionSettingsFile(new TextDocumentHelper(fileContent))
        .result?.properties.extensions?.properties.bruno?.properties;
}
