import { Block, RequestFileBlockName } from "../../../../client/src/shared";

export function getCodeBlocks(allBlocks: Block[]) {
    return allBlocks.filter(({ name }) =>
        [
            RequestFileBlockName.PreRequestScript,
            RequestFileBlockName.PostResponseScript,
            RequestFileBlockName.Tests,
        ].includes(name as RequestFileBlockName)
    );
}
