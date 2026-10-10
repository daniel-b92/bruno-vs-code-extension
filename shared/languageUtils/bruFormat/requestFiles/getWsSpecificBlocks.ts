import {
    AuthBlockName,
    Oauth2AdditionalParamsBlockNames,
    RequestFileBlockName,
} from "../../..";

export function getWsSpecificBlocks() {
    return [RequestFileBlockName.Ws, RequestFileBlockName.WsBody];
}

/**
 * All blocks that are valid within websocket requests.
 * Blocks that are specific to other request types (e.g. HTTP method blocks, params, scripts or non-websocket bodies) are not valid.
 */
export function getValidBlockNamesForWsRequest(): string[] {
    return [
        RequestFileBlockName.Meta,
        RequestFileBlockName.Docs,
        RequestFileBlockName.Headers,
        RequestFileBlockName.Settings,
        ...getWsSpecificBlocks(),
        ...Object.values(AuthBlockName),
        ...Object.values(Oauth2AdditionalParamsBlockNames),
    ];
}
