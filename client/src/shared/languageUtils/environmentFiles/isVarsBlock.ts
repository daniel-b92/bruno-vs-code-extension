import { EnvironmentFileBlockName } from "../..";

export function isVarsBlock(blockName: string) {
    return blockName == EnvironmentFileBlockName.Vars;
}
