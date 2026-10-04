import { ParsedRequestFile } from "@global_shared";

/**
 * @returns The sections for the different request types (e.g. `http` or `graphql`) that are present in the file.
 * These have the properties in common that are not specific to a request type (e.g. headers and auth).
 */
export function getRequestTypeSections({
    http,
    graphql,
    websocket,
}: ParsedRequestFile["properties"]) {
    return [http, graphql, websocket].filter((section) => section != undefined);
}
