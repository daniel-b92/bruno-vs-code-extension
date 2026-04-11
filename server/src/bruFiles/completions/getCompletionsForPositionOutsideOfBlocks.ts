import {
    Block,
    BrunoFileType,
    EnvironmentFileBlockName,
    getActiveFieldFromMethodBlock,
    getAllMethodBlocks,
    getAuthTypesForNoDefinedAuthBlock,
    getBodyBlockTypeForNoDefinedBodyBlock,
    getPossibleMethodBlocks,
    getValidBlockNamesForCollectionSettingsFile,
    getValidBlockNamesForFolderSettingsFile,
    isAuthBlock,
    isBodyBlock,
    MethodBlockAuthValues,
    MethodBlockBodies,
    MethodBlockKey,
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

    if (fileType == BrunoFileType.RequestFile) {
        return getMissingMandatoryBlocksForRequestFile(allBlocks).missingBlocks;
    }

    const missingMandatoryBlocks: MissingBlock[] = !allBlocks.some(
        ({ name }) => name == RequestFileBlockName.Meta,
    )
        ? [{ mandatory: true, name: RequestFileBlockName.Meta }]
        : [];

    return missingMandatoryBlocks;
}

function getMissingMandatoryBlocksForRequestFile(allBlocks: Block[]): {
    isAuthBlockOptional: boolean;
    isBodyBlockOptional: boolean;
    missingBlocks: MissingBlock[];
} {
    const result: MissingBlock[] = !allBlocks.some(
        ({ name }) => name == RequestFileBlockName.Meta,
    )
        ? [{ mandatory: true, name: RequestFileBlockName.Meta }]
        : [];

    if (getAllMethodBlocks(allBlocks).length == 0) {
        return {
            isAuthBlockOptional: true,
            isBodyBlockOptional: true,
            missingBlocks: result.concat({
                mandatory: true,
                mutuallyExclusiveBlocks: getPossibleMethodBlocks(),
            }),
        };
    }

    const methodBlockAuthField = getActiveFieldFromMethodBlock(
        allBlocks,
        MethodBlockKey.Auth,
    );
    let isAuthBlockOptional = true;

    if (
        methodBlockAuthField &&
        (Object.values(MethodBlockAuthValues) as string[]).includes(
            methodBlockAuthField.value,
        )
    ) {
        // If the auth type is defined in the method block, the auth block becomes mandatory.
        isAuthBlockOptional = false;

        const expectedAuthBlock = getAuthTypesForNoDefinedAuthBlock().includes(
            methodBlockAuthField.value,
        )
            ? undefined
            : `auth:${methodBlockAuthField.value}`;

        if (
            expectedAuthBlock &&
            !allBlocks.some(({ name }) => name == expectedAuthBlock)
        ) {
            result.push({ mandatory: true, name: expectedAuthBlock });
        }
    }

    const methodBlockBodyField = getActiveFieldFromMethodBlock(
        allBlocks,
        MethodBlockKey.Body,
    );
    let isBodyBlockOptional = true;

    if (
        methodBlockBodyField &&
        (Object.values(MethodBlockBodies) as string[]).includes(
            methodBlockBodyField.value,
        )
    ) {
        // If the body type is defined in the method block, the body block becomes mandatory.
        isAuthBlockOptional = false;
        const expectedBodyBlock =
            getBodyBlockTypeForNoDefinedBodyBlock() ==
            methodBlockBodyField.value
                ? undefined
                : `body:${methodBlockBodyField.value}`;

        if (
            expectedBodyBlock &&
            !allBlocks.some(({ name }) => name == expectedBodyBlock)
        ) {
            result.push({ mandatory: true, name: expectedBodyBlock });
        }
    }

    return { isAuthBlockOptional, isBodyBlockOptional, missingBlocks: result };
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
