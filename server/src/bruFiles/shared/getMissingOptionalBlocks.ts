import {
    Block,
    BrunoFileType,
    EnvironmentFileBlockName,
    getPossibleMethodBlocks,
    getValidBlockNamesForCollectionSettingsFile,
    getValidBlockNamesForFolderSettingsFile,
    isAuthBlock,
    isBodyBlock,
    RequestFileBlockName,
} from "@global_shared";
import { MissingBlock } from "./interfaces";

export function getMissingOptionalBlocks(
    fileType: BrunoFileType,
    allBlocks: Block[],
): MissingBlock[] {
    switch (fileType) {
        case BrunoFileType.EnvironmentFile:
            return getMissingBlocksWithoutExclusivityToOthers(
                Object.values(EnvironmentFileBlockName),
                allBlocks,
                false,
            );
        case BrunoFileType.CollectionSettingsFile:
            return getMissingOptionalBlocksForFolderOrCollectionSettingsFile(
                allBlocks,
                true,
            );
        case BrunoFileType.FolderSettingsFile:
            return getMissingOptionalBlocksForFolderOrCollectionSettingsFile(
                allBlocks,
                false,
            );
        case BrunoFileType.RequestFile:
            return getMissingOptionalBlocksForRequestFile(allBlocks);
    }
}

function getMissingOptionalBlocksForRequestFile(allBlocks: Block[]) {
    const allValidOptionalBlocks = Object.values(RequestFileBlockName).filter(
        (name) =>
            // filter out mandatory blocks
            name != RequestFileBlockName.Meta &&
            !getPossibleMethodBlocks().includes(name),
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
) {
    const allValidOptionalBlocks = isCollectionSettingsFile
        ? getValidBlockNamesForCollectionSettingsFile()
        : // The meta block is mandatory for folder settings files.
          getValidBlockNamesForFolderSettingsFile().filter(
              (name) => name != RequestFileBlockName.Meta,
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
