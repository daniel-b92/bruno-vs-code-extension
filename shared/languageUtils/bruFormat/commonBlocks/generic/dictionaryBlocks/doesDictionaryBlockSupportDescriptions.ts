import {
    getPossibleMethodBlocks,
    isAuthBlock,
    Oauth2AdditionalParamsBlockNames,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
} from "../../../../..";

export function doesDictionaryBlockSupportDescriptions(
    dictionaryBlockName: string,
) {
    return !(
        (getPossibleMethodBlocks() as string[]).includes(dictionaryBlockName) ||
        isAuthBlock(dictionaryBlockName) ||
        (Object.values(Oauth2AdditionalParamsBlockNames) as string[]).includes(
            dictionaryBlockName,
        ) ||
        (
            [
                RequestFileBlockName.Meta,
                RequestFileBlockName.Settings,
                RequestFileBlockName.App,
                SettingsFileSpecificBlock.AuthMode,
            ] as string[]
        ).includes(dictionaryBlockName)
    );
}
