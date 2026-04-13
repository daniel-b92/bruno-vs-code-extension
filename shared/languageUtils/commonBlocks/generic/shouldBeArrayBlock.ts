import { EnvironmentFileBlockName } from "../../..";

export function shouldBeArrayBlock(blockName: string) {
    return blockName == EnvironmentFileBlockName.SecretVars;
}
