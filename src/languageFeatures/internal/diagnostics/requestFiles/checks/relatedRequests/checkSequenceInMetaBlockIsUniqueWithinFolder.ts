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
} from "../../../../../../shared";
import { dirname } from "path";
import { readFileSync } from "fs";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { isSequenceValid } from "../../../shared/util/isSequenceValid";

export function checkSequenceInMetaBlockIsUniqueWithinFolder(
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

    const otherRequestsInFolder = getSequencesForOtherRequestsInFolder(
        itemProvider,
        documentUri,
        dirname(documentUri.fsPath)
    );

    const otherRequestsWithSameSequence = otherRequestsInFolder
        .filter(
            ({ sequence: existingSequence }) =>
                Number.parseInt(sequenceField.value) == existingSequence
        )
        .map(({ file }) => file);

    if (otherRequestsWithSameSequence.length > 0) {
        const allAffectedFiles = otherRequestsWithSameSequence.concat(
            documentUri.fsPath
        );

        return {
            code: getDiagnosticCode(),
            toAdd: {
                affectedFiles: allAffectedFiles,
                diagnosticCurrentFile: getDiagnostic(
                    sequenceField,
                    otherRequestsWithSameSequence
                ),
            },
        };
    } else {
        return { code: getDiagnosticCode() };
    }
}

function getDiagnostic(
    sequenceField: DictionaryBlockField,
    otherRequestsWithSameSequence: string[]
): DiagnosticWithCode {
    return {
        message:
            "Other requests with the same sequence already exists within this folder.",
        range: mapRange(sequenceField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: getDiagnosticCode(),
        relatedInformation: otherRequestsWithSameSequence.map((path) => ({
            message: `Request with same sequence`,
            location: {
                uri: Uri.file(path),
                range: getRangeForSequence(path),
            },
        })),
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

function getSequencesForOtherRequestsInFolder(
    itemProvider: CollectionItemProvider,
    documentUri: Uri,
    directoryPath: string
) {
    const result: { file: string; sequence: number }[] = [];

    const otherRequestsInFolder = getOtherRequestsInFolder(
        itemProvider,
        directoryPath,
        documentUri
    );

    result.push(
        ...otherRequestsInFolder.map((requestFile) => ({
            file: requestFile.getPath(),
            sequence: requestFile.getSequence() as number,
        }))
    );

    return result;
}

function getOtherRequestsInFolder(
    itemProvider: CollectionItemProvider,
    directoryPath: string,
    documentUri: Uri
): CollectionFile[] {
    const result: CollectionFile[] = [];

    const collection = itemProvider.getAncestorCollectionForPath(directoryPath);

    if (!collection) {
        console.warn(
            `Could not determine collection for directory path '${directoryPath}'`
        );
        return result;
    }

    return collection
        .getAllStoredDataForCollection()
        .filter(({ item }) => {
            const itemPath = item.getPath();

            return (
                item instanceof CollectionFile &&
                normalizeDirectoryPath(dirname(itemPath)) ==
                    normalizeDirectoryPath(directoryPath) &&
                item.getSequence() != undefined &&
                itemPath != documentUri.fsPath &&
                getTypeOfBrunoFile([collection], itemPath) ==
                    BrunoFileType.RequestFile
            );
        })
        .map(({ item }) => item as CollectionFile);
}

function getDiagnosticCode() {
    return RelevantWithinMetaBlockDiagnosticCode.SequenceNotUniqueWithinFolder;
}
