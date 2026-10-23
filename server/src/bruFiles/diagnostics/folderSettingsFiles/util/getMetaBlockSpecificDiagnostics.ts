import {
    TextDocumentHelper,
    Block,
    isBlockDictionaryBlock,
    MetaBlockKey,
    getMetaBlockMandatoryKeys,
    getMetaBlockOptionalKeys,
    BrunoFileType,
    getActiveFieldFromDictionaryBlock,
    isDictionaryBlockArrayField,
    isDictionaryBlockField,
    shouldBeDictionaryArrayField,
    RequestFileBlockName,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { checkDictionaryBlockArrayFieldsStructure } from "../../shared/checks/singleBlocks/checkDictionaryBlockArrayFieldsStructure";
import { runChecksForTagsField } from "../../shared/checks/singleBlocks/runChecksForTagsField";
import { checkMetaBlockStartsInFirstLine } from "../../shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import { DiagnosticWithCode } from "../../interfaces";
import { checkSequenceInMetaBlockIsValid } from "../../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { RelatedFilesDiagnosticsHelper } from "../../shared/helpers/relatedFilesDiagnosticsHelper";
import { checkFolderSequenceInMetaBlockIsUnique } from "../checks/checkFolderSequenceInMetaBlockIsUnique";
import { TypedCollectionItemProvider } from "../../../../shared";

export function getMetaBlockSpecificDiagnostics(data: {
    itemProvider: TypedCollectionItemProvider;
    relatedFilesHelper: RelatedFilesDiagnosticsHelper;
    folderSettingsPath: string;
    documentHelper: TextDocumentHelper;
    metaBlock: Block;
}): (DiagnosticWithCode | undefined)[] {
    const {
        documentHelper,
        folderSettingsPath,
        itemProvider,
        metaBlock,
        relatedFilesHelper,
    } = data;
    const mandatoryKeys = getMetaBlockMandatoryKeys(
        BrunoFileType.FolderSettingsFile,
    );
    const optionalKeys = getMetaBlockOptionalKeys(
        BrunoFileType.FolderSettingsFile,
    );

    if (!mandatoryKeys || !optionalKeys) {
        return [];
    }

    const diagnostics: (DiagnosticWithCode | undefined)[] = [
        checkSequenceInMetaBlockIsValid(metaBlock),
    ];

    if (isBlockDictionaryBlock(metaBlock)) {
        const tagsField = getActiveFieldFromDictionaryBlock(
            metaBlock,
            MetaBlockKey.Tags,
        );

        diagnostics.push(
            checkNoKeysAreMissingForDictionaryBlock(
                metaBlock,
                mandatoryKeys,
                RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock,
            ),
            checkNoUnknownKeysAreDefinedInDictionaryBlock(
                metaBlock,
                mandatoryKeys.concat(optionalKeys),
                RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock,
            ),
            checkNoMandatoryValuesAreMissingForDictionaryBlock(
                metaBlock,
                [MetaBlockKey.Name],
                RelevantWithinMetaBlockDiagnosticCode.MandatoryValuesMissingInMetaBlock,
            ),
            ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock({
                filePath: folderSettingsPath,
                block: metaBlock,
                diagnosticCode:
                    RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
                expectedKeys: mandatoryKeys.concat(optionalKeys),
            }) ?? []),
            checkDictionaryBlockArrayFieldsStructure(
                folderSettingsPath,
                metaBlock,
                metaBlock.content
                    .filter(isDictionaryBlockField)
                    .map(({ key }) => key)
                    .filter((existing) =>
                        shouldBeDictionaryArrayField(
                            RequestFileBlockName.Meta,
                            existing,
                        ),
                    ),
            ),
            checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
            ...(tagsField && isDictionaryBlockArrayField(tagsField)
                ? runChecksForTagsField(folderSettingsPath, tagsField)
                : []),
        );
    }

    for (const results of provideRelatedFilesDiagnosticsForMetaBlock({
        metaBlock,
        folderSettingsPath,
        itemProvider,
        docHelper: documentHelper,
        relatedFilesHelper,
    })) {
        diagnostics.push(results.result);
    }

    return diagnostics;
}

function provideRelatedFilesDiagnosticsForMetaBlock(data: {
    metaBlock: Block;
    folderSettingsPath: string;
    itemProvider: TypedCollectionItemProvider;
    docHelper: TextDocumentHelper;
    relatedFilesHelper: RelatedFilesDiagnosticsHelper;
}): {
    folderSettingsPath: string;
    result: DiagnosticWithCode;
}[] {
    const { relatedFilesHelper, folderSettingsPath } = data;
    const { code, toAdd } = checkFolderSequenceInMetaBlockIsUnique(data);

    if (toAdd) {
        relatedFilesHelper.registerDiagnostic({
            files: toAdd.affectedFiles,
            diagnosticCode: code,
        });

        return [{ folderSettingsPath, result: toAdd.diagnosticCurrentFile }];
    } else {
        relatedFilesHelper.unregisterDiagnostic(folderSettingsPath, code);
        return [];
    }
}
