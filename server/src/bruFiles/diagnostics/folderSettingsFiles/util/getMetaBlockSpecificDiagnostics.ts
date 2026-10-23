import {
    TextDocumentHelper,
    Block,
    isBlockDictionaryBlock,
    BrunoFileType,
} from "@global_shared";
import { getCommonMetaBlockDiagnostics } from "../../shared/checks/singleBlocks/getCommonMetaBlockDiagnostics";
import { checkSequenceInMetaBlockIsValid } from "../../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { DiagnosticWithCode } from "../../interfaces";
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
    const diagnostics: (DiagnosticWithCode | undefined)[] =
        isBlockDictionaryBlock(metaBlock)
            ? getCommonMetaBlockDiagnostics({
                  filePath: folderSettingsPath,
                  fileType: BrunoFileType.FolderSettingsFile,
                  documentHelper,
                  metaBlock,
              })
            : [checkSequenceInMetaBlockIsValid(metaBlock)];

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
