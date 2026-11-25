import { CollectionFormat } from "../baseModel/interfaces";

/** Builds the content of a minimal http request file. For Bru files, further blocks can be appended. */
export function requestContent(
    format: CollectionFormat,
    name: string,
    sequence?: number,
    additionalBruBlocks = "",
) {
    const sequenceLine = sequence === undefined ? "" : `  seq: ${sequence}\n`;

    return format == CollectionFormat.Bru
        ? `meta {\n  name: ${name}\n  type: http\n${sequenceLine}}\n${additionalBruBlocks}`
        : `info:\n  name: ${name}\n  type: http\n${sequenceLine}\nhttp:\n  method: GET\n  url: ""\n`;
}

/** A block for a Bru file with a `bru.runRequest` call for the given path. */
export function runRequestBlock(path: string) {
    return `\nscript:pre-request {\n  await bru.runRequest("${path}");\n}\n`;
}
