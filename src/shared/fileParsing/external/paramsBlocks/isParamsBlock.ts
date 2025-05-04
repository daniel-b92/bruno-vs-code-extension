import { RequestFileBlockName } from "../../..";

export function isParamsBlock(blockName: string) {
    return (
        Object.values(RequestFileBlockName).filter((name) =>
            name.startsWith("params:")
        ) as string[]
    ).includes(blockName);
}
