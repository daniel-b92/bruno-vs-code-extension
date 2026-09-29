import { getGrpcScriptBlocks, RequestFileBlockName } from "../../../..";

export function shouldBeCodeBlock(blockName: string) {
    return (
        [
            RequestFileBlockName.PreRequestScript,
            RequestFileBlockName.PostResponseScript,
            RequestFileBlockName.Tests,
            ...getGrpcScriptBlocks(),
        ] as string[]
    ).includes(blockName);
}
