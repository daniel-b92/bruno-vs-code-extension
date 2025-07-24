import {
    getPossibleMethodBlocks,
    RequestFileBlockName,
    isAuthBlock,
    isParamsBlock,
    isVarsBlockInRequestFile,
    isVarsBlockInEnvironmentFile,
    EnvironmentFileBlockName,
    SettingsFileSpecificBlock,
} from "../..";

export function shouldBeDictionaryBlock(blockName: string) {
    const allBlockNames = (
        Object.values(RequestFileBlockName) as string[]
    ).concat(
        (Object.values(EnvironmentFileBlockName) as string[]).concat(
            Object.values(SettingsFileSpecificBlock)
        )
    );

    if (!allBlockNames.includes(blockName)) {
        return undefined;
    }

    return (
        blockName == RequestFileBlockName.Meta ||
        blockName == RequestFileBlockName.Headers ||
        blockName == RequestFileBlockName.Assertions ||
        blockName == RequestFileBlockName.Settings ||
        (getPossibleMethodBlocks() as string[]).includes(blockName) ||
        isAuthBlock(blockName) ||
        isParamsBlock(blockName) ||
        isVarsBlockInRequestFile(blockName) ||
        (
            [
                RequestFileBlockName.MultipartFormBody,
                RequestFileBlockName.FormUrlEncodedBody,
                RequestFileBlockName.FileOrBinaryBody,
            ] as string[]
        ).includes(blockName) ||
        isVarsBlockInEnvironmentFile(blockName) ||
        blockName == SettingsFileSpecificBlock.AuthMode
    );
}
