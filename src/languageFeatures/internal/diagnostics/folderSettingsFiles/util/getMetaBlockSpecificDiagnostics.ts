import {
    TextDocumentHelper,
    Block,
    castBlockToDictionaryBlock,
    MetaBlockKey,
    CollectionItemProvider,
} from "../../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkMetaBlockStartsInFirstLine } from "../../shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import { DiagnosticWithCode } from "../../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { checkSequenceInMetaBlockIsValid } from "../../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { Uri } from "vscode";
import { RelatedFilesDiagnosticsHelper } from "../../shared/helpers/relatedFilesDiagnosticsHelper";
import { checkFolderSequenceInMetaBlockIsUnique } from "../checks/checkFolderSequenceInMetaBlockIsUnique";

export async function getMetaBlockSpecificDiagnostics(
    itemProvider: CollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    documentUri: Uri,
    documentHelper: TextDocumentHelper,
    metaBlock: Block
): Promise<(DiagnosticWithCode | undefined)[]> {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);
    const metaBlockKeys = [MetaBlockKey.Name, MetaBlockKey.Sequence];

    const diagnostics = [
        checkSequenceInMetaBlockIsValid(metaBlock),
        castedMetaBlock
            ? checkNoKeysAreMissingForDictionaryBlock(
                  castedMetaBlock,
                  metaBlockKeys,
                  RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock
              )
            : undefined,
        castedMetaBlock
            ? checkNoUnknownKeysAreDefinedInDictionaryBlock(
                  castedMetaBlock,
                  metaBlockKeys,
                  RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock
              )
            : undefined,
        castedMetaBlock
            ? checkNoMandatoryValuesAreMissingForDictionaryBlock(
                  castedMetaBlock,
                  [MetaBlockKey.Name],
                  RelevantWithinMetaBlockDiagnosticCode.MandatoryValuesMissingInMetaBlock
              )
            : undefined,
        castedMetaBlock
            ? checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                  castedMetaBlock,
                  metaBlockKeys,
                  RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock
              )
            : undefined,
        castedMetaBlock
            ? checkMetaBlockStartsInFirstLine(documentHelper, metaBlock)
            : undefined,
    ];

    for (const results of await provideRelatedFilesDiagnosticsForMetaBlock(
        itemProvider,
        metaBlock,
        documentUri,
        relatedFilesHelper
    )) {
        diagnostics.push(results.result);
    }

    return diagnostics;
}

async function provideRelatedFilesDiagnosticsForMetaBlock(
    itemProvider: CollectionItemProvider,
    metaBlock: Block,
    documentUri: Uri,
    relatedRequestsHelper: RelatedFilesDiagnosticsHelper
): Promise<
    {
        uri: Uri;
        result: DiagnosticWithCode;
    }[]
> {
    const { code, toAdd } = await checkFolderSequenceInMetaBlockIsUnique(
        itemProvider,
        metaBlock,
        documentUri
    );

    if (toAdd) {
        relatedRequestsHelper.registerDiagnostic({
            files: toAdd.affectedFiles,
            diagnosticCode: code,
        });

        return [{ uri: documentUri, result: toAdd.diagnosticCurrentFile }];
    } else {
        relatedRequestsHelper.unregisterDiagnostic(documentUri.fsPath, code);
        return [];
    }
}
