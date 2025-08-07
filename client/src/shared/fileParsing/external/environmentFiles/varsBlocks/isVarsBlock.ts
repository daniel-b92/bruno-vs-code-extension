import { EnvironmentFileBlockName } from "../../../../languageUtils/environmentFiles/environmentFileBlockNameEnum";

export function isVarsBlock(blockName: string) {
    return blockName == EnvironmentFileBlockName.Vars;
}
