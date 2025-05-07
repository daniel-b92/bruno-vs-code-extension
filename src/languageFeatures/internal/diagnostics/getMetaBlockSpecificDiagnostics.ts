import { Uri } from "vscode";
import {
    TextDocumentHelper,
    Block,
    castBlockToDictionaryBlock,
    MetaBlockKey,
    DictionaryBlockField,
    RequestType,
    CollectionItemProvider,
} from "../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "./shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockFieldIsValid } from "./shared/checks/singleBlocks/checkValueForDictionaryBlockFieldIsValid";
import { checkMetaBlockStartsInFirstLine } from "./shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import { DiagnosticWithCode } from "./definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "./shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelatedRequestsDiagnosticsHelper } from "./requestFiles/helpers/relatedRequestsDiagnosticsHelper";
import { checkSequenceInMetaBlockIsValid } from "./requestFiles/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./requestFiles/checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";

export function getMetaBlockSpecificDiagnostics(
    itemProvider: CollectionItemProvider,
    relatedRequestsHelper: RelatedRequestsDiagnosticsHelper,
    documentUri: Uri,
    documentHelper: TextDocumentHelper,
    metaBlock: Block
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
    metaBlock: Block,
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
