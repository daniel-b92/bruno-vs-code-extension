import { CollectionFormat } from "../baseModel/interfaces";

/** Builds the content of a minimal folder settings file. */
export function folderSettingsContent(
    format: CollectionFormat,
    name: string,
    sequence: number,
) {
    return format == CollectionFormat.Yaml
        ? `info:\n  name: ${name}\n  type: folder\n  seq: ${sequence}\n`
        : `meta {\n  name: ${name}\n  seq: ${sequence}\n}\n`;
}
