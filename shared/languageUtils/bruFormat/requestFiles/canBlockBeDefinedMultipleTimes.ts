import { RequestFileBlockName } from "./requestFileBlockNameEnum";

/**
 * Websocket requests can have multiple messages, which are defined as separate `body:ws` blocks.
 * All other blocks may only be defined once.
 */
export function canBlockBeDefinedMultipleTimes(blockName: string) {
    return blockName == RequestFileBlockName.WsBody;
}
