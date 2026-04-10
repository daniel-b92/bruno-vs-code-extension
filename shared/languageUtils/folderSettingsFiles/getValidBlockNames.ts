import {
    AuthBlockName,
    Oauth2AdditionalParamsBlockNames,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
} from "../..";

export function getValidBlockNames(): string[] {
    return [
        RequestFileBlockName.Meta,
        RequestFileBlockName.Headers,
        SettingsFileSpecificBlock.AuthMode,
        ...Object.values(AuthBlockName),
        ...Object.values(Oauth2AdditionalParamsBlockNames),
        RequestFileBlockName.PreRequestVars,
        RequestFileBlockName.PostResponseVars,
        RequestFileBlockName.PreRequestScript,
        RequestFileBlockName.PostResponseScript,
        RequestFileBlockName.Tests,
        RequestFileBlockName.Docs,
    ];
}
