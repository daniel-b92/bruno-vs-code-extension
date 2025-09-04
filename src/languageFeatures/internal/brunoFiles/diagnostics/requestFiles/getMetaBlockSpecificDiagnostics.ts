import { Uri } from "vscode";
import {
    TextDocumentHelper,
    Block,
    MetaBlockKey,
    RequestType,
    CollectionItemProvider,
    isDictionaryBlockSimpleField,
    shouldBeDictionaryArrayField,
    RequestFileBlockName,
    DictionaryBlock,
    isDictionaryBlockArrayField,
} from "../../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { checkMetaBlockStartsInFirstLine } from "../shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";
import { checkSequenceInMetaBlockIsValid } from "../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";
import { checkDictionaryBlockArrayFieldsStructure } from "../shared/checks/singleBlocks/checkDictionaryBlockArrayFieldsStructure";
import { checkDictionaryBlockArrayFieldsValues } from "../shared/checks/singleBlocks/checkDictionaryBlockArrayFieldsValues";

export async function getMetaBlockSpecificDiagnostics(
    itemProvider: CollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    documentUri: Uri,
    documentHelper: TextDocumentHelper,
    metaBlock: DictionaryBlock,
): Promise<(DiagnosticWithCode | undefined)[]> {
    const mandatoryBlockKeys = [
        MetaBlockKey.Name,
        MetaBlockKey.Sequence,
        MetaBlockKey.Type,
    ];
    const optionalBlockKeys = [MetaBlockKey.Tags];
    const typeFields = metaBlock.content.filter(
        ({ key }) => key == MetaBlockKey.Type,
    );
    const tagsFields = metaBlock.content.filter(
        ({ key }) => key == MetaBlockKey.Tags,
    );

    const diagnostics = [
        checkSequenceInMetaBlockIsValid(metaBlock),
        checkNoKeysAreMissingForDictionaryBlock(
            metaBlock,
            mandatoryBlockKeys,
            RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            metaBlock,
            mandatoryBlockKeys.concat(optionalBlockKeys),
            RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock,
        ),
        checkNoMandatoryValuesAreMissingForDictionaryBlock(
            metaBlock,
            [MetaBlockKey.Name],
            RelevantWithinMetaBlockDiagnosticCode.MandatoryValuesMissingInMetaBlock,
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            metaBlock,
            mandatoryBlockKeys.concat(optionalBlockKeys),
            RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
        ),
        checkDictionaryBlockArrayFieldsStructure(
            documentUri,
            metaBlock,
            metaBlock.content
                .map(({ key }) => key)
                .filter((existing) =>
                    shouldBeDictionaryArrayField(
                        RequestFileBlockName.Meta,
                        existing,
                    ),
                ),
        ),
        tagsFields.length == 1 && isDictionaryBlockArrayField(tagsFields[0])
            ? checkDictionaryBlockArrayFieldsValues(documentUri, [
                  tagsFields[0],
              ])
            : undefined,
        typeFields.length == 1 && isDictionaryBlockSimpleField(typeFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  typeFields[0],
                  Object.values(RequestType),
                  RelevantWithinMetaBlockDiagnosticCode.RequestTypeNotValid,
              )
            : undefined,
        checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
    ];

    for (const results of await provideRelatedFilesDiagnosticsForMetaBlock(
        itemProvider,
        metaBlock,
        documentUri,
        relatedFilesHelper,
    )) {
        diagnostics.push(results.result);
    }

    return diagnostics;
}

async function provideRelatedFilesDiagnosticsForMetaBlock(
    itemProvider: CollectionItemProvider,
    metaBlock: Block,
    documentUri: Uri,
    relatedRequestsHelper: RelatedFilesDiagnosticsHelper,
): Promise<
    {
        uri: Uri;
        result: DiagnosticWithCode;
    }[]
> {
    const { code, toAdd } = await checkSequenceInMetaBlockIsUniqueWithinFolder(
        itemProvider,
        metaBlock,
        documentUri,
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
