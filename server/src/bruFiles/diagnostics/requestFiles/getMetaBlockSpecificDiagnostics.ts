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
    getMetaBlockMandatoryKeys,
    getMetaBlockOptionalKeys,
    BrunoFileType,
    getActiveFieldFromDictionaryBlock,
    isDictionaryBlockField,
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

export function getMetaBlockSpecificDiagnostics(
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    filePath: string,
    documentHelper: TextDocumentHelper,
    metaBlock: DictionaryBlock,
): (DiagnosticWithCode | undefined)[] {
    const mandatoryBlockKeys = getMetaBlockMandatoryKeys(
        BrunoFileType.RequestFile,
    );
    const optionalBlockKeys = getMetaBlockOptionalKeys(
        BrunoFileType.RequestFile,
    );

    if (!mandatoryBlockKeys || !optionalBlockKeys) {
        return [];
    }

    const typeField = getActiveFieldFromDictionaryBlock(
        metaBlock,
        MetaBlockKey.Type,
    );
    const tagsField = getActiveFieldFromDictionaryBlock(
        metaBlock,
        MetaBlockKey.Tags,
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
                .filter(isDictionaryBlockField)
                .map(({ key }) => key)
                .filter((existing) =>
                    shouldBeDictionaryArrayField(
                        RequestFileBlockName.Meta,
                        existing,
                    ),
                ),
        ),
        typeField && isDictionaryBlockSimpleField(typeField)
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  typeField,
                  Object.values(RequestType),
                  RelevantWithinMetaBlockDiagnosticCode.RequestTypeNotValid,
              )
            : undefined,
        checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
    ].concat(
        tagsField && isDictionaryBlockArrayField(tagsField)
            ? runChecksForTagsField(filePath, tagsField)
            : [],
    );

    for (const results of provideRelatedFilesDiagnosticsForMetaBlock({
        itemProvider,
        metaBlock,
        filePath,
        relatedFilesHelper,
        docHelper: documentHelper,
    })) {
        diagnostics.push(results.result);
    }

    return diagnostics;
}

function provideRelatedFilesDiagnosticsForMetaBlock(data: {
    metaBlock: Block;
    filePath: string;
    itemProvider: TypedCollectionItemProvider;
    docHelper: TextDocumentHelper;
    relatedFilesHelper: RelatedFilesDiagnosticsHelper;
}): {
    filePath: string;
    result: DiagnosticWithCode;
}[] {
    const { filePath, relatedFilesHelper: relatedRequestsHelper } = data;
    const { code, toAdd } = checkSequenceInMetaBlockIsUniqueWithinFolder(data);

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
