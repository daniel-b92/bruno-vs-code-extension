import {
    AuthModeBlockKey,
    Block,
    BrunoFileType,
    EnvironmentFileBlockName,
    getActiveFieldFromMethodBlock,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    getAuthTypesForNoDefinedAuthBlock,
    getExpectedAuthBlockForType,
    getGraphQlSpecificBlocks,
    getValidBlockNamesForCollectionSettingsFile,
    getValidBlockNamesForFolderSettingsFile,
    isAuthBlock,
    isBodyBlock,
    MetaBlockKey,
    MethodBlockAuthValues,
    MethodBlockKey,
    Oauth2AdditionalParamsBlockNames,
    RequestFileBlockName,
    RequestType,
    SettingsFileSpecificBlock,
} from "@global_shared";
import { MissingBlock } from "./interfaces";

export function getMissingOptionalBlocks(
    fileType: BrunoFileType,
    allBlocks: Block[],
    blocksThatCannotBeOptional: string[],
): MissingBlock[] {
    switch (fileType) {
        case BrunoFileType.EnvironmentFile:
            return getMissingBlocksWithoutExclusivityToOthers(
                Object.values(EnvironmentFileBlockName).filter(
                    (name) => !blocksThatCannotBeOptional.includes(name),
                ),
                allBlocks,
                false,
            );
        case BrunoFileType.CollectionSettingsFile:
            return getMissingOptionalBlocksForFolderOrCollectionSettingsFile(
                allBlocks,
                true,
                blocksThatCannotBeOptional,
            );
        case BrunoFileType.FolderSettingsFile:
            return getMissingOptionalBlocksForFolderOrCollectionSettingsFile(
                allBlocks,
                false,
                blocksThatCannotBeOptional,
            );
        case BrunoFileType.RequestFile:
            return getMissingOptionalBlocksForRequestFile(
                allBlocks,
                blocksThatCannotBeOptional,
            );
    }
}

function getMissingOptionalBlocksForRequestFile(
    allBlocks: Block[],
    blocksThatCannotBeOptional: string[],
) {
    const requestType = getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
        allBlocks,
        RequestFileBlockName.Meta,
        MetaBlockKey.Type,
    )?.value;
    const authType = getActiveFieldFromMethodBlock(
        allBlocks,
        MethodBlockKey.Auth,
    )?.value;

    const allValidOptionalBlocks = Object.values(RequestFileBlockName).filter(
        (name) =>
            !blocksThatCannotBeOptional.includes(name) &&
            // GraphQL specific blocks only make sense if it's a GraphQL request.
            (!requestType ||
                requestType == RequestType.Graphql ||
                !getGraphQlSpecificBlocks().includes(name)) &&
            // OAuth2 specific additional blocks only make sense if OAuth2 authorization is used.
            (!authType ||
                authType == MethodBlockAuthValues.Oauth2 ||
                !(
                    Object.values(Oauth2AdditionalParamsBlockNames) as string[]
                ).includes(name)),
    );
    const mutuallyExclusiveBlocksForAuth = allValidOptionalBlocks.filter(
        (name) => isAuthBlock(name),
    );
    const mutuallyExclusiveBlocksForBody = allValidOptionalBlocks.filter(
        (name) => isBodyBlock(name),
    );
    const blocksWithSingleChoice = allValidOptionalBlocks.filter(
        (name) =>
            !mutuallyExclusiveBlocksForAuth
                .concat(mutuallyExclusiveBlocksForBody)
                .includes(name),
    );

    return getMissingBlocksWithoutExclusivityToOthers(
        blocksWithSingleChoice,
        allBlocks,
        false,
    ).concat(
        getMissingMutuallyExclusiveBlocks(
            mutuallyExclusiveBlocksForAuth,
            allBlocks,
            false,
        ),
        getMissingMutuallyExclusiveBlocks(
            mutuallyExclusiveBlocksForBody,
            allBlocks,
            false,
        ),
    );
}

function getMissingOptionalBlocksForFolderOrCollectionSettingsFile(
    allBlocks: Block[],
    isCollectionSettingsFile: boolean,
    blocksThatCannotBeOptional: string[],
) {
    const authModeFromAuthBlock =
        getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
            allBlocks,
            SettingsFileSpecificBlock.AuthMode,
            AuthModeBlockKey.Mode,
        )?.value;

    const allValidOptionalBlocks = (
        isCollectionSettingsFile
            ? getValidBlockNamesForCollectionSettingsFile()
            : // The meta block is mandatory for folder settings files.
              getValidBlockNamesForFolderSettingsFile().filter(
                  (name) => name != RequestFileBlockName.Meta,
              )
    ).filter(
        (name) =>
            !blocksThatCannotBeOptional.includes(name) &&
            // Auth blocks only make sense if the auth type matches the one defined in the auth mode block.
            (!authModeFromAuthBlock ||
                !isAuthBlock(name) ||
                getAuthTypesForNoDefinedAuthBlock().includes(
                    authModeFromAuthBlock,
                ) ||
                name == getExpectedAuthBlockForType(authModeFromAuthBlock)) &&
            // OAuth2 specific additional blocks only make sense if OAuth2 authorization is used.
            (!authModeFromAuthBlock ||
                authModeFromAuthBlock == MethodBlockAuthValues.Oauth2 ||
                !(
                    Object.values(Oauth2AdditionalParamsBlockNames) as string[]
                ).includes(name)),
    );
    const mutuallyExclusiveBlocksForAuth = allValidOptionalBlocks.filter(
        (name) => isAuthBlock(name),
    );
    const blocksWithSingleChoice = allValidOptionalBlocks.filter(
        (name) => !isAuthBlock(name),
    );

    return getMissingBlocksWithoutExclusivityToOthers(
        blocksWithSingleChoice,
        allBlocks,
        false,
    ).concat(
        getMissingMutuallyExclusiveBlocks(
            mutuallyExclusiveBlocksForAuth,
            allBlocks,
            false,
        ),
    );
}

function getMissingBlocksWithoutExclusivityToOthers(
    blocksWithSingleChoice: string[],
    allBlocks: Block[],
    areBlocksMandatory: boolean,
): MissingBlock[] {
    return blocksWithSingleChoice
        .filter(
            (optionalBlock) =>
                !allBlocks.some(
                    ({ name: existing }) => existing == optionalBlock,
                ),
        )
        .map((name) => ({ mandatory: areBlocksMandatory, name }));
}

function getMissingMutuallyExclusiveBlocks(
    mutuallyExclusiveBlocks: string[],
    allBlocks: Block[],
    areBlocksMandatory: boolean,
): MissingBlock[] {
    return !mutuallyExclusiveBlocks.some((optionalBlock) =>
        allBlocks.some(({ name: existing }) => existing == optionalBlock),
    )
        ? [{ mandatory: areBlocksMandatory, mutuallyExclusiveBlocks }]
        : [];
}
