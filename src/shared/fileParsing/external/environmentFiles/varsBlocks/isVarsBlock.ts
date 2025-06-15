import { EnvironmentFileBlockName } from "../../../../languageUtils/environmentFileBlockNameEnum";

export function isVarsBlock(blockName: string) {
    return blockName == EnvironmentFileBlockName.Vars;
}
