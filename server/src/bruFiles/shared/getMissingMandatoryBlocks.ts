import {
    AuthBlockName,
    AuthModeBlockKey,
    Block,
    BrunoFileType,
    getActiveFieldFromMethodBlock,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    getAllMethodBlocks,
    getAllValidBodyBlocks,
    getAuthTypesForNoDefinedAuthBlock,
    getBodyBlockTypeForNoDefinedBodyBlock,
    getPossibleMethodBlocks,
    MethodBlockAuthValues,
    MethodBlockBodies,
    MethodBlockKey,
    RequestFileBlockName,
    SettingsFileSpecificBlock,
} from "@global_shared";
import { MissingBlock } from "./interfaces";

export function getMissingMandatoryBlocks(
    fileType: BrunoFileType,
    allBlocks: Block[],
): { missingBlocks: MissingBlock[]; blocksThatCannotBeOptional: string[] } {
    switch (fileType) {
        case BrunoFileType.EnvironmentFile:
            return { blocksThatCannotBeOptional: [], missingBlocks: [] };
        case BrunoFileType.CollectionSettingsFile:
            return getMissingConditionallyMandatoryBlocksForFolderOrCollectionSettings(
                allBlocks,
            );
        case BrunoFileType.FolderSettingsFile:
            const isMetaBlockMissing =
                checkIfSimpleMandatoryBlockIsMissing(
                    allBlocks,
                    RequestFileBlockName.Meta,
                ).length > 0;

            const { blocksThatCannotBeOptional, missingBlocks } =
                getMissingConditionallyMandatoryBlocksForFolderOrCollectionSettings(
                    allBlocks,
                );
            return {
                blocksThatCannotBeOptional: blocksThatCannotBeOptional.concat(
                    RequestFileBlockName.Meta,
                ),
                missingBlocks: missingBlocks.concat(
                    isMetaBlockMissing
                        ? [
                              {
                                  mandatory: true,
                                  name: RequestFileBlockName.Meta,
                              },
                          ]
                        : [],
                ),
            };
        case BrunoFileType.RequestFile:
            return getMissingMandatoryBlocksForRequestFile(allBlocks);
    }
}

function getMissingConditionallyMandatoryBlocksForFolderOrCollectionSettings(
    allBlocks: Block[],
): {
    missingBlocks: MissingBlock[];
    blocksThatCannotBeOptional: string[];
} {
    const authBlockModeField =
        getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
            allBlocks,
            SettingsFileSpecificBlock.AuthMode,
            AuthModeBlockKey.Mode,
        );

    if (!authBlockModeField) {
        return { blocksThatCannotBeOptional: [], missingBlocks: [] };
    }

    const expectedAuthBlock = getExpectedAuthBlockForType(
        authBlockModeField.value,
    );
    const blocksThatCannotBeOptional = Object.values(AuthBlockName);
    return allBlocks.some(({ name }) => name == expectedAuthBlock)
        ? {
              blocksThatCannotBeOptional,
              missingBlocks: [],
          }
        : {
              blocksThatCannotBeOptional,
              missingBlocks: [{ mandatory: true, name: expectedAuthBlock }],
          };
}

function getMissingMandatoryBlocksForRequestFile(allBlocks: Block[]): {
    missingBlocks: MissingBlock[];
    blocksThatCannotBeOptional: string[];
} {
    const blocksThatCannotBeOptional: string[] = [
        RequestFileBlockName.Meta,
        ...getPossibleMethodBlocks(),
    ];
    const result: MissingBlock[] = checkIfSimpleMandatoryBlockIsMissing(
        allBlocks,
        RequestFileBlockName.Meta,
    );

    if (getAllMethodBlocks(allBlocks).length == 0) {
        return {
            blocksThatCannotBeOptional,
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

    if (
        methodBlockAuthField &&
        (Object.values(MethodBlockAuthValues) as string[]).includes(
            methodBlockAuthField.value,
        )
    ) {
        // If the auth type is defined in the method block, the auth block becomes mandatory.
        blocksThatCannotBeOptional.push(...Object.values(AuthBlockName));

        const expectedAuthBlock = getAuthTypesForNoDefinedAuthBlock().includes(
            methodBlockAuthField.value,
        )
            ? undefined
            : getExpectedAuthBlockForType(methodBlockAuthField.value);

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

    if (
        methodBlockBodyField &&
        (Object.values(MethodBlockBodies) as string[]).includes(
            methodBlockBodyField.value,
        )
    ) {
        // If the body type is defined in the method block, the body block becomes mandatory.
        blocksThatCannotBeOptional.push(...getAllValidBodyBlocks());

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

    return { blocksThatCannotBeOptional, missingBlocks: result };
}

function checkIfSimpleMandatoryBlockIsMissing(
    allBlocks: Block[],
    blockName: string,
): MissingBlock[] {
    return !allBlocks.some(({ name }) => name == blockName)
        ? [{ mandatory: true, name: blockName }]
        : [];
}

function getExpectedAuthBlockForType(authType: string) {
    return `auth:${authType}`;
}
