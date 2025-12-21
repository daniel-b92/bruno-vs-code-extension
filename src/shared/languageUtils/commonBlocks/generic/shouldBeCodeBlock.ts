import { RequestFileBlockName } from "../../..";

export function shouldBeCodeBlock(blockName: string) {
    return (
        [
            RequestFileBlockName.PreRequestScript,
            RequestFileBlockName.PostResponseScript,
            RequestFileBlockName.Tests,
        ] as string[]
    ).includes(blockName);
}
