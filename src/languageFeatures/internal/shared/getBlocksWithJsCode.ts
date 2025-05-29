import { Block, RequestFileBlockName } from "../../../shared";

export function getBlocksWithJsCode(allBlocks: Block[]) {
    return allBlocks.filter(({ name }) =>
        [
            RequestFileBlockName.PreRequestScript,
            RequestFileBlockName.PostResponseScript,
            RequestFileBlockName.Tests,
        ].includes(name as RequestFileBlockName)
    );
}
