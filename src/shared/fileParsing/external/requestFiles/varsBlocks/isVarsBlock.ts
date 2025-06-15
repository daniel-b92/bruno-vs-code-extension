import { RequestFileBlockName } from "../../../..";

export function isVarsBlock(blockName: string) {
    return (
        Object.values(RequestFileBlockName).filter((name) =>
            name.startsWith("vars:")
        ) as string[]
    ).includes(blockName);
}
