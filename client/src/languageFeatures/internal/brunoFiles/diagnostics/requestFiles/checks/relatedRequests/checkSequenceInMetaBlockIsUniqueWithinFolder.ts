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
    mapToVsCodeRange,
    BrunoFileType,
    isCollectionItemWithSequence,
    TypedCollectionItemProvider,
} from "@shared";
import { dirname } from "path";
import { DiagnosticWithCode } from "../../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../../../shared/util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { getRangeForSequenceValue } from "../../../shared/util/getRangeForSequenceValue";

export async function checkSequenceInMetaBlockIsUniqueWithinFolder(
    itemProvider: TypedCollectionItemProvider,
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
    sequenceField: DictionaryBlockSimpleField,
    otherRequestsWithSameSequence: string[],
): Promise<DiagnosticWithCode> {
    return {
        message:
            "Other requests with the same sequence already exists within this folder.",
        range: mapToVsCodeRange(sequenceField.valueRange),
        severity: DiagnosticSeverity.Error,
        code: getDiagnosticCode(),
        relatedInformation: (
            await Promise.all(
                otherRequestsWithSameSequence.map(async (path) => {
                    const range = await getRangeForSequenceValue(path);

                    return range
                        ? {
                              message: `Request with same sequence`,
                              location: {
                                  uri: Uri.file(path),
                                  range,
                              },
                          }
                        : undefined;
                }),
            )
        ).filter((val) => val != undefined),
    };
}

async function getSequencesForOtherRequestsInFolder(
    itemProvider: TypedCollectionItemProvider,
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
    itemProvider: TypedCollectionItemProvider,
    directoryPath: string,
    documentUri: Uri,
): Promise<BrunoRequestFile[]> {
    const result: BrunoRequestFile[] = [];

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
                    item.isFile() &&
                    normalizeDirectoryPath(dirname(itemPath)) ==
                        normalizeDirectoryPath(directoryPath) &&
                    isCollectionItemWithSequence(item) &&
                    item.getSequence() != undefined &&
                    itemPath != documentUri.fsPath &&
                    item.getItemType() == BrunoFileType.RequestFile
                );
            },
        )
    ).map(({ item }) => item as BrunoRequestFile);
}

function getDiagnosticCode() {
    return RelevantWithinMetaBlockDiagnosticCode.RequestSequenceNotUniqueWithinFolder;
}
