import {
    DictionaryBlockSimpleField,
    normalizePath,
    Block,
    MetaBlockKey,
    BrunoRequestFile,
    BrunoFileType,
    isCollectionItemWithSequence,
    getActiveFieldFromMetaBlock,
    isDictionaryBlockSimpleField,
    TextDocumentHelper,
} from "@global_shared";
import { dirname } from "path";
import { DiagnosticWithCode } from "../../../interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../../../shared/util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { getRangeForSequenceValue } from "../../../shared/util/getRangeForSequenceValue";
import { TypedCollectionItemProvider } from "../../../../../shared";
import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
} from "vscode-languageserver";
import { URI } from "vscode-uri";

export function checkSequenceInMetaBlockIsUniqueWithinFolder(data: {
    metaBlock: Block;
    filePath: string;
    docHelper: TextDocumentHelper;
    itemProvider: TypedCollectionItemProvider;
}): {
    code: RelevantWithinMetaBlockDiagnosticCode;
    toAdd?: {
        affectedFiles: string[];
        diagnosticCurrentFile: DiagnosticWithCode;
    };
} {
    const { docHelper, filePath, itemProvider, metaBlock } = data;
    const sequenceField = getActiveFieldFromMetaBlock(
        metaBlock,
        MetaBlockKey.Sequence,
    );
    if (
        !sequenceField ||
        !isDictionaryBlockSimpleField(sequenceField) ||
        !doesDictionaryBlockFieldHaveValidIntegerValue(sequenceField, 1)
    ) {
        return { code: getDiagnosticCode() };
    }

    const otherRequestsInFolder = getSequencesForOtherRequestsInFolder(
        itemProvider,
        filePath,
        dirname(filePath),
    );

    const otherRequestsWithSameSequence = otherRequestsInFolder
        .filter(
            ({ sequence: existingSequence }) =>
                Number.parseInt(sequenceField.value) == existingSequence,
        )
        .map(({ file }) => file);

    if (otherRequestsWithSameSequence.length == 0) {
        return { code: getDiagnosticCode() };
    }

    const allAffectedFiles = otherRequestsWithSameSequence.concat(filePath);

    const relatedInformation = getDiagnosticRelatedInformation(
        otherRequestsWithSameSequence,
        docHelper,
    );

    if (relatedInformation.length == 0) {
        // This case seems to occur sometimes directly after a drag-and-drop operation in the explorer.
        // Maybe it's related to the way multiple sequences are updated in the same folder.
        console.warn(
            "Could not determine related information for diagnostic for multiple requests with same sequence.",
        );
        return { code: getDiagnosticCode() };
    }

    return {
        code: getDiagnosticCode(),
        toAdd: {
            affectedFiles: allAffectedFiles,
            diagnosticCurrentFile: getDiagnostic(
                sequenceField,
                relatedInformation,
            ),
        },
    };
}

function getDiagnostic(
    sequenceField: DictionaryBlockSimpleField,
    relatedInformation: DiagnosticRelatedInformation[],
): DiagnosticWithCode {
    return {
        message:
            "Other requests with the same sequence already exists within this folder.",
        range: sequenceField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: getDiagnosticCode(),
        relatedInformation,
    };
}

function getSequencesForOtherRequestsInFolder(
    itemProvider: TypedCollectionItemProvider,
    filePath: string,
    directoryPath: string,
) {
    const result: { file: string; sequence: number }[] = [];

    const otherRequestsInFolder = getOtherRequestsInFolder(
        itemProvider,
        directoryPath,
        filePath,
    );

    result.push(
        ...otherRequestsInFolder.map((requestFile) => ({
            file: requestFile.getPath(),
            sequence: requestFile.getSequence() as number,
        })),
    );

    return result;
}

function getOtherRequestsInFolder(
    itemProvider: TypedCollectionItemProvider,
    directoryPath: string,
    filePath: string,
): BrunoRequestFile[] {
    const result: BrunoRequestFile[] = [];

    const collection = itemProvider.getAncestorCollectionForPath(directoryPath);

    if (!collection) {
        console.warn(
            `Could not determine collection for directory path '${directoryPath}'`,
        );
        return result;
    }

    return collection
        .getAllStoredDataForCollection()
        .slice()
        .filter(({ item }) => {
            const itemPath = item.getPath();

            return (
                item.isFile() &&
                normalizePath(dirname(itemPath)) ==
                    normalizePath(directoryPath) &&
                isCollectionItemWithSequence(item) &&
                item.getSequence() != undefined &&
                normalizePath(itemPath) != normalizePath(filePath) &&
                item.getItemType() == BrunoFileType.RequestFile
            );
        })
        .map(({ item }) => item as BrunoRequestFile);
}

function getDiagnosticRelatedInformation(
    otherRequestsWithSameSequence: string[],
    docHelper: TextDocumentHelper,
) {
    return otherRequestsWithSameSequence
        .map((path) => {
            const range = getRangeForSequenceValue(path, docHelper);

            return range
                ? {
                      message: `Request with same sequence`,
                      location: {
                          uri: URI.file(path).toString(),
                          range,
                      },
                  }
                : undefined;
        })
        .filter((val) => val != undefined);
}

function getDiagnosticCode() {
    return RelevantWithinMetaBlockDiagnosticCode.RequestSequenceNotUniqueWithinFolder;
}
