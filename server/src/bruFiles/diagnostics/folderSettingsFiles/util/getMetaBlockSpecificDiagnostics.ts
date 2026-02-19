import {
    TextDocumentHelper,
    Block,
    isBlockDictionaryBlock,
    MetaBlockKey,
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

export async function getMetaBlockSpecificDiagnostics(
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    filePath: string,
    documentHelper: TextDocumentHelper,
    metaBlock: Block,
): Promise<(DiagnosticWithCode | undefined)[]> {
    const metaBlockKeys = [MetaBlockKey.Name, MetaBlockKey.Sequence];

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
                  checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                      filePath,
                      metaBlock,
                      RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
                      metaBlockKeys,
                  ),
                  checkMetaBlockStartsInFirstLine(documentHelper, metaBlock)),
              ]
            : [],
    );

    for (const results of await provideRelatedFilesDiagnosticsForMetaBlock(
        itemProvider,
        metaBlock,
        filePath,
        relatedFilesHelper,
    )) {
        diagnostics.push(results.result);
    }

    return diagnostics;
}

async function provideRelatedFilesDiagnosticsForMetaBlock(
    itemProvider: TypedCollectionItemProvider,
    metaBlock: Block,
    filePath: string,
    relatedRequestsHelper: RelatedFilesDiagnosticsHelper,
): Promise<
    {
        filePath: string;
        result: DiagnosticWithCode;
    }[]
> {
    const { code, toAdd } = await checkFolderSequenceInMetaBlockIsUnique(
        itemProvider,
        metaBlock,
        filePath,
    );

    if (toAdd) {
        relatedRequestsHelper.registerDiagnostic({
            files: toAdd.affectedFiles,
            diagnosticCode: code,
        });

        return [{ filePath, result: toAdd.diagnosticCurrentFile }];
    } else {
        relatedRequestsHelper.unregisterDiagnostic(filePath, code);
        return [];
    }
}
