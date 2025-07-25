import {
    AuthBlockName,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
} from "../..";

export function getValidBlockNamesForFolderSettingsFiles(): string[] {
    return [
        RequestFileBlockName.Meta,
        RequestFileBlockName.Headers,
        SettingsFileSpecificBlock.AuthMode,
        ...Object.values(AuthBlockName),
        RequestFileBlockName.PreRequestVars,
        RequestFileBlockName.PostResponseVars,
        RequestFileBlockName.PreRequestScript,
        RequestFileBlockName.PostResponseScript,
        RequestFileBlockName.Tests,
        RequestFileBlockName.Docs,
    ];
}
