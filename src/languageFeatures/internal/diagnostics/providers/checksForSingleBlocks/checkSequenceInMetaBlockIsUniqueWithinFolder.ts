import {
    Diagnostic,
    DiagnosticCollection,
    DiagnosticSeverity,
    EventEmitter,
    Uri,
} from "vscode";
import {
    CollectionData,
    CollectionFile,
    CollectionItemProvider,
    DictionaryBlockField,
    normalizeDirectoryPath,
    RequestFileBlock,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../../../shared";
import { DiagnosticCode } from "../../diagnosticCodeEnum";
import { addDiagnosticForDocument } from "../../util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "../../util/removeDiagnosticsForDocument";
import { MetaBlockFieldName } from "../../../../../shared/fileSystem/testFileParsing/definitions/metaBlockFieldNameEnum";
import { dirname } from "path";
import { parseBlockFromTestFile } from "../../../../../shared/fileSystem/testFileParsing/internal/parseBlockFromTestFile";
import { readFileSync } from "fs";

export function checkSequenceInMetaBlockIsUniqueWithinFolder(
    itemProvider: CollectionItemProvider,
    metaBlock: RequestFileBlock,
    documentUri: Uri,
    existingDiagnostics: DiagnosticCollection,
    fetchDiagnosticsTrigger: EventEmitter<string[]>
) {
    if (
        Array.isArray(metaBlock.content) &&
        metaBlock.content.filter(
            ({ name, value }) =>
                name == MetaBlockFieldName.Sequence &&
                !Number.isNaN(Number.parseInt(value))
        ).length == 1
    ) {
        const sequenceField = metaBlock.content.find(
            ({ name }) => name == MetaBlockFieldName.Sequence
        ) as DictionaryBlockField;

        const otherRequestsInFolder = getSequencesForOtherRequestsInFolder(
            itemProvider,
            documentUri,
            dirname(documentUri.fsPath)
        );

        const requestsWithSameSequence = otherRequestsInFolder.filter(
            ({ sequence: existingSequence }) =>
                Number.parseInt(sequenceField.value) == existingSequence
        );

        if (requestsWithSameSequence.length > 0) {
            addDiagnosticForDocument(
                documentUri,
                existingDiagnostics,
                getDiagnostic(
                    sequenceField,
                    requestsWithSameSequence.map(({ file }) => file)
                )
            );
        } else {
            handleRemovealOfDiagnostic(
                itemProvider,
                documentUri,
                existingDiagnostics,
                fetchDiagnosticsTrigger
            );
        }
    } else {
        handleRemovealOfDiagnostic(
            itemProvider,
            documentUri,
            existingDiagnostics,
            fetchDiagnosticsTrigger
        );
    }
}

function handleRemovealOfDiagnostic(
    itemProvider: CollectionItemProvider,
    documentUri: Uri,
    existingDiagnostics: DiagnosticCollection,
    fetchDiagnosticsTrigger: EventEmitter<string[]>
) {
    const removedDiagnostics = removeDiagnosticsForDocument(
        documentUri,
        existingDiagnostics,
        DiagnosticCode.SequenceNotUniqueWithinFolder
    );

    if (removedDiagnostics > 0) {
        fetchDiagnosticsTrigger.fire(
            getOtherRequestsInFolder(
                itemProvider,
                dirname(documentUri.fsPath),
                documentUri
            )
                .filter(
                    ({ item }) =>
                        item instanceof CollectionFile &&
                        existingDiagnostics.get(Uri.file(item.getPath())) !=
                            undefined
                )
                .map(({ item }) => item.getPath())
        );
    }
}

function getDiagnostic(
    sequenceField: DictionaryBlockField,
    requestsWithSameSequence: string[]
): Diagnostic {
    return {
        message:
            "Other requests with the same sequence already exists within this folder.",
        range: sequenceField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: DiagnosticCode.SequenceNotUniqueWithinFolder,
        relatedInformation: requestsWithSameSequence.map((path) => ({
            message: `Request with same sequence`,
            location: {
                uri: Uri.file(path),
                range: getRangeForSequence(path),
            },
        })),
    };
}

function getRangeForSequence(filePath: string) {
    const metaBlock = parseBlockFromTestFile(
        new TextDocumentHelper(readFileSync(filePath).toString()),
        RequestFileBlockName.Meta
    );

    if (
        !metaBlock ||
        !Array.isArray(metaBlock) ||
        !metaBlock.some(({ name }) => name == MetaBlockFieldName.Sequence)
    ) {
        throw new Error(
            `'${
                RequestFileBlockName.Meta
            }' block did not have expected format for file '${filePath}'. Got '${
                RequestFileBlockName.Meta
            }': ${JSON.stringify(metaBlock, null, 2)}.`
        );
    }

    return (
        metaBlock.find(
            ({ name }) => name == MetaBlockFieldName.Sequence
        ) as DictionaryBlockField
    ).valueRange;
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
        ...otherRequestsInFolder.map(({ item }) => ({
            file: item.getPath(),
            sequence: (item as CollectionFile).getSequence() as number,
        }))
    );

    return result;
}

function getOtherRequestsInFolder(
    itemProvider: CollectionItemProvider,
    directoryPath: string,
    documentUri: Uri
) {
    const result: CollectionData[] = [];

    const collection = itemProvider.getAncestorCollectionForPath(directoryPath);

    if (!collection) {
        console.warn(
            `Could not determine collection for directory path '${directoryPath}'`
        );
        return result;
    }

    return collection
        .getAllStoredDataForCollection()
        .filter(
            ({ item }) =>
                item instanceof CollectionFile &&
                normalizeDirectoryPath(dirname(item.getPath())) ==
                    normalizeDirectoryPath(directoryPath) &&
                item.getSequence() != undefined &&
                item.getPath() != documentUri.fsPath
        );
}
