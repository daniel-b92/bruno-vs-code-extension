import { RequestFileBlockName } from "../../..";

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
