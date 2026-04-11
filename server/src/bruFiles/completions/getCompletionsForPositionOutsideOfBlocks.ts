import {
    Block,
    BrunoFileType,
    EnvironmentFileBlockName,
    getAllMethodBlocks,
    getPossibleMethodBlocks,
    getValidBlockNamesForCollectionSettingsFile,
    getValidBlockNamesForFolderSettingsFile,
    isAuthBlock,
    isBodyBlock,
    Range,
    RequestFileBlockName,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../shared";
import { CompletionItem } from "vscode-languageserver";

type MissingBlock =
    | {
          mandatory: boolean;
          name: string;
      }
    | {
          mandatory: boolean;
          mutuallyExclusiveBlocks: string[];
      };

export function getCompletionsForPositionOutsideOfBlocks(
    request: LanguageFeatureBaseRequest,
    fileType: BrunoFileType,
    allBlocks: Block[],
): CompletionItem[] | undefined {
    const missingMandatoryBlocks = getMissingMandatoryBlocks(
        fileType,
        allBlocks,
    );
    const missingOptionalBlocks = getMissingOptionalBlocks(fileType, allBlocks);

    if (
        missingMandatoryBlocks.length == 0 &&
        missingOptionalBlocks.length == 0
    ) {
        return undefined;
    }

    return missingMandatoryBlocks
        .concat(missingOptionalBlocks)
        .flatMap((block) => mapToCompletionItems(block, request));
}

function mapToCompletionItems(
    block: MissingBlock,
    request: LanguageFeatureBaseRequest,
) {
    return "mutuallyExclusiveBlocks" in block
        ? block.mutuallyExclusiveBlocks.map((blockName) =>
              mapToCompletionItem(blockName, block.mandatory, request),
          )
        : [mapToCompletionItem(block.name, block.mandatory, request)];

    function mapToCompletionItem(
        blockName: string,
        isMandatory: boolean,
        { position }: LanguageFeatureBaseRequest,
    ): CompletionItem {
        return {
            label: blockName,
            textEdit: {
                newText: blockName,
                range: new Range(position, position),
            },
            sortText: isMandatory ? `a_${blockName}` : `b_${blockName}`,
            labelDetails: isMandatory ? undefined : { detail: ` optional` },
        };
    }
}

function getMissingMandatoryBlocks(
    fileType: BrunoFileType,
    allBlocks: Block[],
): MissingBlock[] {
    if (
        fileType == BrunoFileType.EnvironmentFile ||
        fileType == BrunoFileType.CollectionSettingsFile
    ) {
        return [];
    }

    const missingMandatoryBlocks: MissingBlock[] = !allBlocks.some(
        ({ name }) => name == RequestFileBlockName.Meta,
    )
        ? [{ mandatory: true, name: RequestFileBlockName.Meta }]
        : [];

    if (
        fileType == BrunoFileType.RequestFile &&
        getAllMethodBlocks(allBlocks).length == 0
    ) {
        missingMandatoryBlocks.concat({
            mandatory: true,
            mutuallyExclusiveBlocks: getPossibleMethodBlocks(),
        });
    }

    return missingMandatoryBlocks;
}

function getMissingOptionalBlocks(
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
