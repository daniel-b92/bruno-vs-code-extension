import {
    isParamsBlock,
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
        isParamsBlock(dictionaryBlockName) ||
        (Object.values(Oauth2AdditionalParamsBlockNames) as string[]).includes(
            dictionaryBlockName,
        ) ||
        (
            [
                RequestFileBlockName.App,
                RequestFileBlockName.MultipartFormBody,
                RequestFileBlockName.FormUrlEncodedBody,
                RequestFileBlockName.FileOrBinaryBody,
            ] as string[]
        ).includes(dictionaryBlockName)
    );
}
