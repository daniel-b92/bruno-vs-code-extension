import {
    AuthBlockName,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
} from "../..";

export function getValidBlockNames(): string[] {
    return [
        RequestFileBlockName.Headers,
        SettingsFileSpecificBlock.AuthMode,
        ...Object.values(AuthBlockName),
        RequestFileBlockName.PreRequestVars,
        RequestFileBlockName.PostResponseVars,
        RequestFileBlockName.PreRequestScript,
        RequestFileBlockName.PostResponseScript,
        RequestFileBlockName.Tests,
    ];
}
