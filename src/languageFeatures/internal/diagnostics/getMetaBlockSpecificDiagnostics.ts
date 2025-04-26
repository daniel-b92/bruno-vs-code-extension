import { Uri } from "vscode";
import {
    TextDocumentHelper,
    RequestFileBlock,
    castBlockToDictionaryBlock,
    MetaBlockKey,
    DictionaryBlockField,
    RequestType,
    CollectionItemProvider,
} from "../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "./checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "./checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "./checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "./checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockFieldIsValid } from "./checks/singleBlocks/checkValueForDictionaryBlockFieldIsValid";
import { checkMetaBlockStartsInFirstLine } from "./checks/singleBlocks/metaBlock/checkMetaBlockStartsInFirstLine";
import { checkSequenceInMetaBlockIsValid } from "./checks/singleBlocks/metaBlock/checkSequenceInMetaBlockIsValid";
import { DiagnosticWithCode } from "./definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "./diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";
import { RelatedRequestsDiagnosticsHelper } from "./helpers/relatedRequestsDiagnosticsHelper";

export function getMetaBlockSpecificDiagnostics(
    itemProvider: CollectionItemProvider,
    relatedRequestsHelper: RelatedRequestsDiagnosticsHelper,
    documentUri: Uri,
    documentHelper: TextDocumentHelper,
    metaBlock: RequestFileBlock
): (DiagnosticWithCode | undefined)[] {
    const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);
    const metaBlockKeys = Object.values(MetaBlockKey);

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
        castedMetaBlock &&
        castedMetaBlock.content.filter(({ key }) => key == MetaBlockKey.Type)
            .length == 1
            ? checkValueForDictionaryBlockFieldIsValid(
                  castedMetaBlock.content.find(
                      ({ key }) => key == MetaBlockKey.Type
                  ) as DictionaryBlockField,
                  Object.values(RequestType),
                  RelevantWithinMetaBlockDiagnosticCode.RequestTypeNotValid
              )
            : undefined,
        checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
    ];

    for (const results of provideRelatedRequestsDiagnosticsForMetaBlock(
        itemProvider,
        metaBlock,
        documentUri,
        relatedRequestsHelper
    )) {
        diagnostics.push(results.result);
    }

    return diagnostics;
}

function provideRelatedRequestsDiagnosticsForMetaBlock(
    itemProvider: CollectionItemProvider,
    metaBlock: RequestFileBlock,
    documentUri: Uri,
    relatedRequestsHelper: RelatedRequestsDiagnosticsHelper
): {
    uri: Uri;
    result: DiagnosticWithCode;
}[] {
    const { code, toAdd } = checkSequenceInMetaBlockIsUniqueWithinFolder(
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
