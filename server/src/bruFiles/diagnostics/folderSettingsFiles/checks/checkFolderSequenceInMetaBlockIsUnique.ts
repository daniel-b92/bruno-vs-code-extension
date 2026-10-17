import {
    DictionaryBlockSimpleField,
    Block,
    MetaBlockKey,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    TextDocumentHelper,
} from "@global_shared";
import { basename, dirname } from "path";
import { DiagnosticWithCode } from "../../interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "../../shared/util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { getRangeForSequenceValue } from "../../shared/util/getRangeForSequenceValue";
import { TypedCollectionItemProvider } from "../../../../shared";
import { getSequencesForOtherFoldersWithSameParent } from "../../../../shared/diagnostics/relatedFiles/getSequencesForOtherFoldersWithSameParent";
import { DiagnosticSeverity } from "vscode-languageserver";
import { URI } from "vscode-uri";

export function checkFolderSequenceInMetaBlockIsUnique(data: {
    metaBlock: Block;
    folderSettingsPath: string;
    itemProvider: TypedCollectionItemProvider;
    docHelper: TextDocumentHelper;
}): {
    code: RelevantWithinMetaBlockDiagnosticCode;
    toAdd?: {
        affectedFiles: string[];
        diagnosticCurrentFile: DiagnosticWithCode;
    };
} {
    const { metaBlock, docHelper, folderSettingsPath, itemProvider } = data;
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

    const otherFolderSettings = getSequencesForOtherFoldersWithSameParent(
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
            diagnosticCurrentFile: getDiagnostic(
                sequenceField,
                otherFoldersWithSameSequence,
                docHelper,
            ),
        },
    };
}

function getDiagnostic(
    sequenceField: DictionaryBlockSimpleField,
    otherFoldersWithSameSequence: {
        folderSettingsFile: string;
        folderPath: string;
    }[],
    docHelper: TextDocumentHelper,
): DiagnosticWithCode {
    return {
        message:
            "Other folders with the same sequence already exist for the same parent folder.",
        range: sequenceField.valueRange,
        severity: DiagnosticSeverity.Error,
        code: getDiagnosticCode(),
        relatedInformation: otherFoldersWithSameSequence
            .map(({ folderPath, folderSettingsFile }) => {
                const range = getRangeForSequenceValue(
                    folderSettingsFile,
                    docHelper,
                );

                return range
                    ? {
                          message: `Folder '${basename(
                              folderPath,
                          )}' with same sequence`,
                          location: {
                              uri: URI.file(folderSettingsFile).toString(),
                              range,
                          },
                      }
                    : undefined;
            })
            .filter((val) => val != undefined),
    };
}

function getDiagnosticCode() {
    return RelevantWithinMetaBlockDiagnosticCode.FolderSequenceNotUniqueWithinParentFolder;
}
