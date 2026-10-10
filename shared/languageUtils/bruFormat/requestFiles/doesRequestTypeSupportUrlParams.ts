import { RequestType } from "../commonBlocks/metaBlock/requestTypeEnum";

/**
 * Websocket requests do not have `params:query` or `params:path` blocks, so their URLs are not synchronized with them.
 */
export function doesRequestTypeSupportUrlParams(requestType?: string) {
    return requestType != RequestType.Ws;
}
