import {
    AuthBlockName,
    Oauth2AdditionalParamsBlockNames,
    RequestFileBlockName,
} from "../../..";

export function getGrpcScriptBlocks() {
    return [
        RequestFileBlockName.GrpcBeforeCallStartScript,
        RequestFileBlockName.GrpcBeforeMessageSendScript,
        RequestFileBlockName.GrpcAfterMessageReceiveScript,
        RequestFileBlockName.GrpcAfterCallEndScript,
    ];
}

export function getGrpcSpecificBlocks() {
    return [
        RequestFileBlockName.Grpc,
        RequestFileBlockName.GrpcBody,
        RequestFileBlockName.Metadata,
        ...getGrpcScriptBlocks(),
    ];
}

/**
 * All blocks that are valid within gRPC requests.
 * Blocks that are specific to other request types (e.g. HTTP method blocks, headers, params or non-gRPC bodies) are not valid.
 */
export function getValidBlockNamesForGrpcRequest(): string[] {
    return [
        RequestFileBlockName.Meta,
        RequestFileBlockName.Docs,
        ...getGrpcSpecificBlocks(),
        ...Object.values(AuthBlockName),
        ...Object.values(Oauth2AdditionalParamsBlockNames),
    ];
}
