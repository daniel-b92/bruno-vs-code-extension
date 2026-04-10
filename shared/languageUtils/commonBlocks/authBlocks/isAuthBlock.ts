import { AuthBlockName } from "../../..";

export function isAuthBlock(blockName: string) {
    return (Object.values(AuthBlockName) as string[]).includes(blockName);
}
