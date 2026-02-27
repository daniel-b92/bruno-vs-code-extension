import {
    TextDocumentHelper,
    Block,
    MetaBlockKey,
    RequestType,
    isDictionaryBlockSimpleField,
    shouldBeDictionaryArrayField,
    RequestFileBlockName,
    DictionaryBlock,
    isDictionaryBlockArrayField,
    DictionaryBlockArrayField,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "../shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { checkMetaBlockStartsInFirstLine } from "../shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import { DiagnosticWithCode } from "../interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";
import { checkSequenceInMetaBlockIsValid } from "../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";
import { checkDictionaryBlockArrayFieldsStructure } from "../shared/checks/singleBlocks/checkDictionaryBlockArrayFieldsStructure";
import { checkDictionaryBlockArrayFieldsValues } from "../shared/checks/singleBlocks/checkDictionaryBlockArrayFieldsValues";
import { checkNoDuplicateTagsAreDefined } from "./checks/singleBlocks/checkNoDuplicateTagsAreDefined";
import { TypedCollectionItemProvider } from "../../../shared";

export async function getMetaBlockSpecificDiagnostics(
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    filePath: string,
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
        ({ key, disabled }) => key == MetaBlockKey.Type && !disabled,
    );
    const tagsFields = metaBlock.content.filter(
        ({ key, disabled }) => key == MetaBlockKey.Tags && !disabled,
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
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            filePath,
            metaBlock,
            RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
            mandatoryBlockKeys.concat(optionalBlockKeys),
        ) ?? []),
        checkDictionaryBlockArrayFieldsStructure(
            filePath,
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
        typeFields.length == 1 && isDictionaryBlockSimpleField(typeFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  typeFields[0],
                  Object.values(RequestType),
                  RelevantWithinMetaBlockDiagnosticCode.RequestTypeNotValid,
              )
            : undefined,
        checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
    ].concat(
        tagsFields.length == 1 && isDictionaryBlockArrayField(tagsFields[0])
            ? runChecksForTagsField(filePath, tagsFields[0])
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
    const { code, toAdd } = await checkSequenceInMetaBlockIsUniqueWithinFolder(
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

function runChecksForTagsField(
    filePath: string,
    tagsField: DictionaryBlockArrayField,
) {
    return [
        checkDictionaryBlockArrayFieldsValues(filePath, [tagsField]),
    ].concat(checkNoDuplicateTagsAreDefined(filePath, tagsField));
}
