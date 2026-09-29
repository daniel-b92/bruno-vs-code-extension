import {
    BlockRuntimeExecutionGroup,
    RequestFileBlockName,
} from "../../../../..";

export function getBlockRuntimeExecutionGroup(blockName: string) {
    const allBlocksFromPreRequestGroup = getAllBlocksFromPreRequestGroup();
    const allBlocksFromPostResponseGroup = getAllBlocksFromPostResponseGroup();

    return (allBlocksFromPreRequestGroup as string[]).includes(blockName)
        ? BlockRuntimeExecutionGroup.PreRequest
        : (allBlocksFromPostResponseGroup as string[]).includes(blockName)
          ? BlockRuntimeExecutionGroup.PostResponse
          : BlockRuntimeExecutionGroup.Request;
}

function getAllBlocksFromPreRequestGroup() {
    return [
        RequestFileBlockName.PreRequestScript,
        RequestFileBlockName.PreRequestVars,
        RequestFileBlockName.GrpcBeforeCallStartScript,
        RequestFileBlockName.GrpcBeforeMessageSendScript,
    ];
}

function getAllBlocksFromPostResponseGroup() {
    return [
        RequestFileBlockName.PostResponseScript,
        RequestFileBlockName.PostResponseVars,
        RequestFileBlockName.GrpcAfterMessageReceiveScript,
        RequestFileBlockName.GrpcAfterCallEndScript,
        RequestFileBlockName.Tests,
        RequestFileBlockName.Assertions,
    ];
}
