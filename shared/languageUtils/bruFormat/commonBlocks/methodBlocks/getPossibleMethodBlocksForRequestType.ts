import {
    getPossibleMethodBlocks,
    RequestFileBlockName,
    RequestType,
} from "../../../..";

/**
 * Returns the method blocks that are valid for the given request type.
 * If the request type is not known (yet), all possible method blocks are returned.
 */
export function getPossibleMethodBlocksForRequestType(requestType?: string) {
    const allMethodBlocks = getPossibleMethodBlocks();

    if (requestType == RequestType.Grpc) {
        return [RequestFileBlockName.Grpc];
    }
    if (requestType == RequestType.Ws) {
        return [RequestFileBlockName.Ws];
    }

    return requestType != undefined &&
        (Object.values(RequestType) as string[]).includes(requestType)
        ? allMethodBlocks.filter(
              (name) =>
                  name != RequestFileBlockName.Grpc &&
                  name != RequestFileBlockName.Ws,
          )
        : allMethodBlocks;
}
