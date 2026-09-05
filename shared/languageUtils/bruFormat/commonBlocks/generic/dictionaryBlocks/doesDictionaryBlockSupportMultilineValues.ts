import {
    isVarsBlockInEnvironmentFile,
    isVarsBlockInRequestFile,
    Oauth2AdditionalParamsBlockNames,
    RequestFileBlockName,
} from "../../../../..";

export function doesDictionaryBlockSupportMultilineValues(
    dictionaryBlockName: string,
) {
    return (
        isVarsBlockInRequestFile(dictionaryBlockName) ||
        isVarsBlockInEnvironmentFile(dictionaryBlockName) ||
        (Object.values(Oauth2AdditionalParamsBlockNames) as string[]).includes(
            dictionaryBlockName,
        ) ||
        ([RequestFileBlockName.App] as string[]).includes(dictionaryBlockName)
    );
}
