import {
    TextDocumentHelper,
    Block,
    isBlockDictionaryBlock,
    MetaBlockKey,
    getMetaBlockMandatoryKeys,
    BrunoFileType,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkMetaBlockStartsInFirstLine } from "../../shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import { DiagnosticWithCode } from "../../interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { checkSequenceInMetaBlockIsValid } from "../../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { RelatedFilesDiagnosticsHelper } from "../../shared/helpers/relatedFilesDiagnosticsHelper";
import { checkFolderSequenceInMetaBlockIsUnique } from "../checks/checkFolderSequenceInMetaBlockIsUnique";
import { TypedCollectionItemProvider } from "../../../../shared";

export function getMetaBlockSpecificDiagnostics(
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    folderSettingsPath: string,
    documentHelper: TextDocumentHelper,
    metaBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    const metaBlockKeys = getMetaBlockMandatoryKeys(
        BrunoFileType.FolderSettingsFile,
    );

    if (!metaBlockKeys) {
        return [];
    }

    const diagnostics = [checkSequenceInMetaBlockIsValid(metaBlock)].concat(
        isBlockDictionaryBlock(metaBlock)
            ? [
                  (checkNoKeysAreMissingForDictionaryBlock(
                      metaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock,
                  ),
                  checkNoUnknownKeysAreDefinedInDictionaryBlock(
                      metaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock,
                  ),
                  checkNoMandatoryValuesAreMissingForDictionaryBlock(
                      metaBlock,
                      [MetaBlockKey.Name],
                      RelevantWithinMetaBlockDiagnosticCode.MandatoryValuesMissingInMetaBlock,
                  ),
                  checkNoDuplicateKeysAreDefinedForDictionaryBlock({
                      filePath: folderSettingsPath,
                      block: metaBlock,
                      diagnosticCode:
                          RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
                      expectedKeys: metaBlockKeys,
                  }),
                  checkMetaBlockStartsInFirstLine(documentHelper, metaBlock)),
              ]
            : [],
    );

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
