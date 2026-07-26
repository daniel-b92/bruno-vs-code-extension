import {
    DictionaryBlockSimpleField,
    normalizePath,
    Block,
    MetaBlockKey,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    isCollectionDirectory,
    CollectionDirectory,
} from "@global_shared";
import { basename, dirname } from "path";
import { DiagnosticWithCode } from "../../interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../../shared/util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { getRangeForSequenceValue } from "../../shared/util/getRangeForSequenceValue";
import { TypedCollectionItemProvider } from "../../../../shared";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

export async function checkFolderSequenceInMetaBlockIsUnique(
    itemProvider: TypedCollectionItemProvider,
    metaBlock: Block,
    folderSettingsPath: string,
): Promise<{
    code: RelevantWithinMetaBlockDiagnosticCode;
    toAdd?: {
        affectedFiles: string[];
        diagnosticCurrentFile: DiagnosticWithCode;
    };
}> {
    const sequenceField = getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
        [metaBlock],
        metaBlock.name,
        MetaBlockKey.Sequence,
    );
    if (
        !sequenceField ||
        !doesDictionaryBlockFieldHaveValidIntegerValue(sequenceField, 1)
    ) {
        return { code: getDiagnosticCode() };
    }

    const otherFolderSettings = await getSequencesForOtherFoldersWithSameParent(
        itemProvider,
        folderSettingsPath,
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

    if (otherFoldersWithSameSequence.length == 0) {
        return { code: getDiagnosticCode() };
    }

    const allAffectedFiles = otherFoldersWithSameSequence.concat({
        folderSettingsFile: folderSettingsPath,
        folderPath: dirname(folderSettingsPath),
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
        range: sequenceField.valueRange,
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
                                      uri: URI.file(
                                          folderSettingsFile,
                                      ).toString(),
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
    itemProvider: TypedCollectionItemProvider,
    folderSettingsFile: string,
): Promise<
    {
        folderSettingsFile: string;
        folderPath: string;
        sequence: number;
    }[]
> {
    return getOtherFoldersWithValidSequenceAndSameParentFolder(
        itemProvider,
        folderSettingsFile,
    ).map(({ folderSettingsPath, directory }) => ({
        folderSettingsFile: folderSettingsPath,
        folderPath: directory.getPath(),
        sequence: directory.getSequence() as number,
    }));
}

function getOtherFoldersWithValidSequenceAndSameParentFolder(
    itemProvider: TypedCollectionItemProvider,
    referenceFolderSettings: string,
): {
    directory: CollectionDirectory;
    folderSettingsPath: string;
}[] {
    const collection = itemProvider.getAncestorCollectionForPath(
        referenceFolderSettings,
    );

    if (!collection) {
        console.warn(
            `Could not determine collection for folder settings path '${referenceFolderSettings}'`,
        );
        return [];
    }

    return collection
        .getAllStoredDataForCollection()
        .map(({ item }) => item)
        .filter(isCollectionDirectory)
        .filter((item) => {
            const itemPath = item.getPath();

            return (
                normalizePath(dirname(itemPath)) ==
                    normalizePath(dirname(dirname(referenceFolderSettings))) &&
                item.getSequence() != undefined &&
                normalizePath(itemPath) !=
                    normalizePath(dirname(referenceFolderSettings))
            );
        })
        .map((item) => ({
            directory: item,
            // Only if there is a folder settings file, the folder can have a valid sequence.
            folderSettingsPath: item.getSettingsFilePath() as string,
        }));
}

function getDiagnosticCode() {
    return RelevantWithinMetaBlockDiagnosticCode.FolderSequenceNotUniqueWithinParentFolder;
}
