import { Diagnostic, DiagnosticSeverity, Uri } from "vscode";
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
import { MetaBlockFieldName } from "../../../../../shared/fileSystem/testFileParsing/definitions/metaBlockFieldNameEnum";
import { dirname } from "path";
import { parseBlockFromTestFile } from "../../../../../shared/fileSystem/testFileParsing/internal/parseBlockFromTestFile";
import { readFileSync } from "fs";

export function checkSequenceInMetaBlockIsUniqueWithinFolder(
    itemProvider: CollectionItemProvider,
    metaBlock: RequestFileBlock,
    documentUri: Uri
): {
    code: DiagnosticCode;
    toAdd?: { affectedFiles: string[]; diagnosticCurrentFile: Diagnostic };
} {
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

        const otherRequestsWithSameSequence = otherRequestsInFolder.filter(
            ({ sequence: existingSequence }) =>
                Number.parseInt(sequenceField.value) == existingSequence
        );

        if (otherRequestsWithSameSequence.length > 0) {
            const affectedFiles = otherRequestsWithSameSequence
                .map(({ file }) => file)
                .concat(documentUri.fsPath);

            return {
                code: getDiagnosticCode(),
                toAdd: {
                    affectedFiles,
                    diagnosticCurrentFile: getDiagnostic(
                        sequenceField,
                        affectedFiles
                    ),
                },
            };
        } else {
            return { code: getDiagnosticCode() };
        }
    } else {
        return { code: getDiagnosticCode() };
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
        code: getDiagnosticCode(),
        relatedInformation: requestsWithSameSequence.map((path) => ({
            message: `Request with same sequence`,
            location: {
                uri: Uri.file(path),
                range: getRangeForSequence(path),
            },
        })),
    };
}

function getDiagnosticCode() {
    return DiagnosticCode.SequenceNotUniqueWithinFolder;
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
