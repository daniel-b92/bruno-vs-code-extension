import {
    AuthBlockName,
    RequestFileBlockName,
    FolderSettingsSpecificBlock,
} from "../..";

export function getValidBlockNamesForFolderSettingsFiles(): string[] {
    return [
        RequestFileBlockName.Meta,
        RequestFileBlockName.Headers,
        FolderSettingsSpecificBlock.AuthMode,
        ...Object.values(AuthBlockName),
        RequestFileBlockName.PreRequestVars,
        RequestFileBlockName.PostResponseVars,
        RequestFileBlockName.PreRequestScript,
        RequestFileBlockName.PostResponseScript,
        RequestFileBlockName.Tests,
        RequestFileBlockName.Docs,
    ];
}
