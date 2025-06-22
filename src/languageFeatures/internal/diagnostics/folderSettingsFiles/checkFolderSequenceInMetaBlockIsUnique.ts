import { DiagnosticSeverity, Uri } from "vscode";
import {
    CollectionFile,
    CollectionItemProvider,
    DictionaryBlockField,
    normalizeDirectoryPath,
    Block,
    RequestFileBlockName,
    TextDocumentHelper,
    MetaBlockKey,
    castBlockToDictionaryBlock,
    getSequenceFieldFromMetaBlock,
    mapRange,
    getTypeOfBrunoFile,
    BrunoFileType,
} from "../../../../shared";
import { basename, dirname } from "path";
import { readFileSync } from "fs";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { isSequenceValid } from "../shared/util/isSequenceValid";

export function checkFolderSequenceInMetaBlockIsUnique(
    itemProvider: CollectionItemProvider,
    metaBlock: Block,
    documentUri: Uri
): {
    code: RelevantWithinMetaBlockDiagnosticCode;
    toAdd?: {
        affectedFiles: string[];
        diagnosticCurrentFile: DiagnosticWithCode;
    };
} {
    const castedBlock = castBlockToDictionaryBlock(metaBlock);

    if (
        !castedBlock ||
        castedBlock.content.filter(({ key }) => key == MetaBlockKey.Sequence)
            .length != 1 ||
        !isSequenceValid(
            castedBlock.content.find(
                ({ key }) => key == MetaBlockKey.Sequence
            ) as DictionaryBlockField
        )
    ) {
        return { code: getDiagnosticCode() };
    }

    const sequenceField = castedBlock.content.find(
        ({ key }) => key == MetaBlockKey.Sequence
    ) as DictionaryBlockField;

    const otherFolderSettings = getSequencesForOtherFoldersWithSameParent(
        itemProvider,
        documentUri,
        documentUri.fsPath
    );

    const otherFoldersWithSameSequence = otherFolderSettings
        .filter(
            ({ sequence: existingSequence }) =>
                Number.parseInt(sequenceField.value) == existingSequence
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
                    ({ folderSettingsFile }) => folderSettingsFile
                ),
                diagnosticCurrentFile: getDiagnostic(
                    sequenceField,
                    otherFoldersWithSameSequence
                ),
            },
        };
    } else {
        return { code: getDiagnosticCode() };
    }
}

function getDiagnostic(
    sequenceField: DictionaryBlockField,
    otherFoldersWithSameSequence: {
        folderSettingsFile: string;
        folderPath: string;
    }[]
): DiagnosticWithCode {
    return {
        message:
            "Other folders with the same sequence already exist for the same parent folder.",
        range: mapRange(sequenceField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: getDiagnosticCode(),
        relatedInformation: otherFoldersWithSameSequence.map(
            ({ folderPath, folderSettingsFile }) => ({
                message: `Folder '${basename(folderPath)}' with same sequence`,
                location: {
                    uri: Uri.file(folderSettingsFile),
                    range: getRangeForSequence(folderSettingsFile),
                },
            })
        ),
    };
}

function getRangeForSequence(filePath: string) {
    const sequenceField = getSequenceFieldFromMetaBlock(
        new TextDocumentHelper(readFileSync(filePath).toString())
    );

    if (!sequenceField) {
        throw new Error(
            `'${
                RequestFileBlockName.Meta
            }' block did not have expected format for file '${filePath}'. Got field for '${
                MetaBlockKey.Sequence
            }': ${JSON.stringify(sequenceField, null, 2)}.`
        );
    }

    return mapRange(sequenceField.valueRange);
}

function getSequencesForOtherFoldersWithSameParent(
    itemProvider: CollectionItemProvider,
    documentUri: Uri,
    folderSettingsFile: string
): {
    folderSettingsFile: string;
    folderPath: string;
    sequence: number;
}[] {
    return getOtherFolderSettingsWithSameParentFolder(
        itemProvider,
        folderSettingsFile,
        documentUri
    ).map(({ folderSettings, folderPath }) => ({
        folderSettingsFile: folderSettings.getPath(),
        folderPath,
        sequence: folderSettings.getSequence() as number,
    }));
}

function getOtherFolderSettingsWithSameParentFolder(
    itemProvider: CollectionItemProvider,
    referenceFolderSettings: string,
    documentUri: Uri
): { folderPath: string; folderSettings: CollectionFile }[] {
    const collection = itemProvider.getAncestorCollectionForPath(
        referenceFolderSettings
    );

    if (!collection) {
        console.warn(
            `Could not determine collection for folder settings path '${referenceFolderSettings}'`
        );
        return [];
    }

    return collection
        .getAllStoredDataForCollection()
        .filter(({ item }) => {
            const itemPath = item.getPath();

            return (
                item instanceof CollectionFile &&
                normalizeDirectoryPath(dirname(dirname(itemPath))) ==
                    normalizeDirectoryPath(
                        dirname(dirname(referenceFolderSettings))
                    ) &&
                item.getSequence() != undefined &&
                normalizeDirectoryPath(dirname(itemPath)) !=
                    normalizeDirectoryPath(dirname(documentUri.fsPath)) &&
                getTypeOfBrunoFile([collection], itemPath) ==
                    BrunoFileType.FolderSettingsFile
            );
        })
        .map(({ item }) => ({
            folderSettings: item as CollectionFile,
            folderPath: dirname(item.getPath()),
        }));
}

function getDiagnosticCode() {
    return RelevantWithinMetaBlockDiagnosticCode.FolderSequenceNotUniqueWithinParentFolder;
}
