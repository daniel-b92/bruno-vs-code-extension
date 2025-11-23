import { DiagnosticSeverity, Uri } from "vscode";
import {
    BrunoRequestFile,
    CollectionItemProvider,
    DictionaryBlockSimpleField,
    normalizeDirectoryPath,
    Block,
    RequestFileBlockName,
    TextDocumentHelper,
    MetaBlockKey,
    castBlockToDictionaryBlock,
    getSequenceFieldFromMetaBlock,
    mapToVsCodeRange,
    BrunoFileType,
    filterAsync,
    isDictionaryBlockSimpleField,
    isCollectionItemWithSequence,
} from "../../../../../../shared";
import { basename, dirname } from "path";
import { readFile } from "fs";
import { DiagnosticWithCode } from "../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { isSequenceValid } from "../../shared/util/isSequenceValid";
import { promisify } from "util";

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
    const castedBlock = castBlockToDictionaryBlock(metaBlock);

    if (
        !castedBlock ||
        castedBlock.content.filter(({ key }) => key == MetaBlockKey.Sequence)
            .length != 1 ||
        !isSequenceValid(
            castedBlock.content.find(
                ({ key }) => key == MetaBlockKey.Sequence,
            ) as DictionaryBlockSimpleField,
        )
    ) {
        return { code: getDiagnosticCode() };
    }

    const sequenceField = castedBlock.content.find(
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
        relatedInformation: await Promise.all(
            otherFoldersWithSameSequence.map(
                async ({ folderPath, folderSettingsFile }) => ({
                    message: `Folder '${basename(
                        folderPath,
                    )}' with same sequence`,
                    location: {
                        uri: Uri.file(folderSettingsFile),
                        range: await getRangeForSequence(folderSettingsFile),
                    },
                }),
            ),
        ),
    };
}

async function getRangeForSequence(filePath: string) {
    const readFileAsync = promisify(readFile);
    const fileContent = await readFileAsync(filePath, "utf-8");

    const sequenceField = getSequenceFieldFromMetaBlock(
        new TextDocumentHelper(fileContent),
    );

    if (!sequenceField || !isDictionaryBlockSimpleField(sequenceField)) {
        throw new Error(
            `'${
                RequestFileBlockName.Meta
            }' block did not have expected format for file '${filePath}'. Got field for '${
                MetaBlockKey.Sequence
            }': ${JSON.stringify(sequenceField, null, 2)}.`,
        );
    }

    return mapToVsCodeRange(sequenceField.valueRange);
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
