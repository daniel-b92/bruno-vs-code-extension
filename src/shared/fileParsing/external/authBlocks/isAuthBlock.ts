import { RequestFileBlockName } from "../../..";

export function isAuthBlock(blockName: string) {
    return (
        Object.values(RequestFileBlockName).filter((name) =>
            name.startsWith("auth:")
        ) as string[]
    ).includes(blockName);
}
