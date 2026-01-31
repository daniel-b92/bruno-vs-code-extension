import { DiagnosticSeverity, Uri } from "vscode";
import {
    DictionaryBlockSimpleField,
    normalizeDirectoryPath,
    Block,
    MetaBlockKey,
    isBlockDictionaryBlock,
    filterAsync,
} from "@global_shared";
import {
    BrunoRequestFile,
    CollectionItemProvider,
    mapToVsCodeRange,
    BrunoFileType,
    isCollectionItemWithSequence,
} from "@shared";
import { basename, dirname } from "path";
import { DiagnosticWithCode } from "../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../../shared/util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { getRangeForSequenceValue } from "../../shared/util/getRangeForSequenceValue";

export async function checkFolderSequenceInMetaBlockIsUnique(
    itemProvider: CollectionItemProvider,
    metaBlock: Block,
    documentUri: Uri,
): Promise<{
    code: RelevantWithinMetaBlockDiagnosticCode;
    toAdd?: {
        affectedFiles: string[];
        diagnosticCurrentFile: DiagnosticWithCode;
    };
}> {
    if (
        !isBlockDictionaryBlock(metaBlock) ||
        metaBlock.content.filter(({ key }) => key == MetaBlockKey.Sequence)
            .length != 1 ||
        !doesDictionaryBlockFieldHaveValidIntegerValue(
            metaBlock.content.find(
                ({ key }) => key == MetaBlockKey.Sequence,
            ) as DictionaryBlockSimpleField,
            1,
        )
    ) {
        return { code: getDiagnosticCode() };
    }

    const sequenceField = metaBlock.content.find(
        ({ key }) => key == MetaBlockKey.Sequence,
    ) as DictionaryBlockSimpleField;

    const otherFolderSettings = await getSequencesForOtherFoldersWithSameParent(
        itemProvider,
        documentUri,
        documentUri.fsPath,
    );

    const otherFoldersWithSameSequence = otherFolderSettings
        .filter(
            ({ sequence: existingSequence }) =>
                Number.parseInt(sequenceField.value) == existingSequence,
        )
        .map(({ folderSettingsFile, folderPath }) => ({
            folderSettingsFile,
            folderPath,
        }));

    if (otherFoldersWithSameSequence.length > 0) {
        const allAffectedFiles = otherFoldersWithSameSequence.concat({
            folderSettingsFile: documentUri.fsPath,
            folderPath: dirname(documentUri.fsPath),
        });

        return {
            code: getDiagnosticCode(),
            toAdd: {
                affectedFiles: allAffectedFiles.map(
                    ({ folderSettingsFile }) => folderSettingsFile,
                ),
                diagnosticCurrentFile: await getDiagnostic(
                    sequenceField,
                    otherFoldersWithSameSequence,
                ),
            },
        };
    } else {
        return { code: getDiagnosticCode() };
    }
}

async function getDiagnostic(
    sequenceField: DictionaryBlockSimpleField,
    otherFoldersWithSameSequence: {
        folderSettingsFile: string;
        folderPath: string;
    }[],
): Promise<DiagnosticWithCode> {
    return {
        message:
            "Other folders with the same sequence already exist for the same parent folder.",
        range: mapToVsCodeRange(sequenceField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: getDiagnosticCode(),
        relatedInformation: (
            await Promise.all(
                otherFoldersWithSameSequence.map(
                    async ({ folderPath, folderSettingsFile }) => {
                        const range =
                            await getRangeForSequenceValue(folderSettingsFile);

                        return range
                            ? {
                                  message: `Folder '${basename(
                                      folderPath,
                                  )}' with same sequence`,
                                  location: {
                                      uri: Uri.file(folderSettingsFile),
                                      range,
                                  },
                              }
                            : undefined;
                    },
                ),
            )
        ).filter((val) => val != undefined),
    };
}

async function getSequencesForOtherFoldersWithSameParent(
    itemProvider: CollectionItemProvider,
    documentUri: Uri,
    folderSettingsFile: string,
): Promise<
    {
        folderSettingsFile: string;
        folderPath: string;
        sequence: number;
    }[]
> {
    return (
        await getOtherFolderSettingsWithSameParentFolder(
            itemProvider,
            folderSettingsFile,
            documentUri,
        )
    ).map(({ folderSettings, folderPath }) => ({
        folderSettingsFile: folderSettings.getPath(),
        folderPath,
        sequence: folderSettings.getSequence() as number,
    }));
}

async function getOtherFolderSettingsWithSameParentFolder(
    itemProvider: CollectionItemProvider,
    referenceFolderSettings: string,
    documentUri: Uri,
): Promise<{ folderPath: string; folderSettings: BrunoRequestFile }[]> {
    const collection = itemProvider.getAncestorCollectionForPath(
        referenceFolderSettings,
    );

    if (!collection) {
        console.warn(
            `Could not determine collection for folder settings path '${referenceFolderSettings}'`,
        );
        return [];
    }

    return (
        await filterAsync(
            collection.getAllStoredDataForCollection().slice(),
            async ({ item }) => {
                const itemPath = item.getPath();

                return (
                    item.isFile() &&
                    normalizeDirectoryPath(dirname(dirname(itemPath))) ==
                        normalizeDirectoryPath(
                            dirname(dirname(referenceFolderSettings)),
                        ) &&
                    isCollectionItemWithSequence(item) &&
                    item.getSequence() != undefined &&
                    normalizeDirectoryPath(dirname(itemPath)) !=
                        normalizeDirectoryPath(dirname(documentUri.fsPath)) &&
                    item.getItemType() == BrunoFileType.FolderSettingsFile
                );
            },
        )
    ).map(({ item }) => ({
        folderSettings: item as BrunoRequestFile,
        folderPath: dirname(item.getPath()),
    }));
}

function getDiagnosticCode() {
    return RelevantWithinMetaBlockDiagnosticCode.FolderSequenceNotUniqueWithinParentFolder;
}
