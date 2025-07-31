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
    BrunoFileType,
    filterAsync,
} from "../../../../../../shared";
import { dirname } from "path";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { isSequenceValid } from "../../../shared/util/isSequenceValid";
import { promisify } from "util";
import { readFile } from "fs";

export async function checkSequenceInMetaBlockIsUniqueWithinFolder(
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
            ) as DictionaryBlockField,
        )
    ) {
        return { code: getDiagnosticCode() };
    }

    const sequenceField = castedBlock.content.find(
        ({ key }) => key == MetaBlockKey.Sequence,
    ) as DictionaryBlockField;

    const otherRequestsInFolder = await getSequencesForOtherRequestsInFolder(
        itemProvider,
        documentUri,
        dirname(documentUri.fsPath),
    );

    const otherRequestsWithSameSequence = otherRequestsInFolder
        .filter(
            ({ sequence: existingSequence }) =>
                Number.parseInt(sequenceField.value) == existingSequence,
        )
        .map(({ file }) => file);

    if (otherRequestsWithSameSequence.length > 0) {
        const allAffectedFiles = otherRequestsWithSameSequence.concat(
            documentUri.fsPath,
        );

        return {
            code: getDiagnosticCode(),
            toAdd: {
                affectedFiles: allAffectedFiles,
                diagnosticCurrentFile: await getDiagnostic(
                    sequenceField,
                    otherRequestsWithSameSequence,
                ),
            },
        };
    } else {
        return { code: getDiagnosticCode() };
    }
}

async function getDiagnostic(
    sequenceField: DictionaryBlockField,
    otherRequestsWithSameSequence: string[],
): Promise<DiagnosticWithCode> {
    return {
        message:
            "Other requests with the same sequence already exists within this folder.",
        range: mapRange(sequenceField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: getDiagnosticCode(),
        relatedInformation: await Promise.all(
            otherRequestsWithSameSequence.map(async (path) => ({
                message: `Request with same sequence`,
                location: {
                    uri: Uri.file(path),
                    range: await getRangeForSequence(path),
                },
            })),
        ),
    };
}

async function getRangeForSequence(filePath: string) {
    const readFileAsync = promisify(readFile);
    const sequenceField = getSequenceFieldFromMetaBlock(
        new TextDocumentHelper(await readFileAsync(filePath, "utf-8")),
    );

    if (!sequenceField) {
        throw new Error(
            `'${
                RequestFileBlockName.Meta
            }' block did not have expected format for file '${filePath}'. Got field for '${
                MetaBlockKey.Sequence
            }': ${JSON.stringify(sequenceField, null, 2)}.`,
        );
    }

    return mapRange(sequenceField.valueRange);
}

async function getSequencesForOtherRequestsInFolder(
    itemProvider: CollectionItemProvider,
    documentUri: Uri,
    directoryPath: string,
) {
    const result: { file: string; sequence: number }[] = [];

    const otherRequestsInFolder = await getOtherRequestsInFolder(
        itemProvider,
        directoryPath,
        documentUri,
    );

    result.push(
        ...otherRequestsInFolder.map((requestFile) => ({
            file: requestFile.getPath(),
            sequence: requestFile.getSequence() as number,
        })),
    );

    return result;
}

async function getOtherRequestsInFolder(
    itemProvider: CollectionItemProvider,
    directoryPath: string,
    documentUri: Uri,
): Promise<CollectionFile[]> {
    const result: CollectionFile[] = [];

    const collection = itemProvider.getAncestorCollectionForPath(directoryPath);

    if (!collection) {
        console.warn(
            `Could not determine collection for directory path '${directoryPath}'`,
        );
        return result;
    }

    return (
        await filterAsync(
            collection.getAllStoredDataForCollection().slice(),
            async ({ item }) => {
                const itemPath = item.getPath();

                return (
                    item instanceof CollectionFile &&
                    normalizeDirectoryPath(dirname(itemPath)) ==
                        normalizeDirectoryPath(directoryPath) &&
                    item.getSequence() != undefined &&
                    itemPath != documentUri.fsPath &&
                    item.getFileType() == BrunoFileType.RequestFile
                );
            },
        )
    ).map(({ item }) => item as CollectionFile);
}

function getDiagnosticCode() {
    return RelevantWithinMetaBlockDiagnosticCode.RequestSequenceNotUniqueWithinFolder;
}
