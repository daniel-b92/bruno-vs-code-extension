import {
    BrunoFileType,
    DictionaryBlock,
    getActiveFieldFromDictionaryBlock,
    getMetaBlockMandatoryKeys,
    getMetaBlockOptionalKeys,
    isDictionaryBlockArrayField,
    isDictionaryBlockField,
    MetaBlockKey,
    RequestFileBlockName,
    shouldBeDictionaryArrayField,
    TextDocumentHelper,
} from "@global_shared";
import { DiagnosticWithCode } from "../../../interfaces";
import { RelevantWithinMetaBlockDiagnosticCode } from "../../diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { checkDictionaryBlockArrayFieldsStructure } from "./checkDictionaryBlockArrayFieldsStructure";
import { checkMetaBlockStartsInFirstLine } from "./checkMetaBlockStartsInFirstLine";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "./checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "./checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "./checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "./checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkSequenceInMetaBlockIsValid } from "./checkSequenceInMetaBlockIsValid";
import { runChecksForTagsField } from "./runChecksForTagsField";

/**
 * Runs the checks on the `meta` block that are the same for request files and folder settings files.
 */
export function getCommonMetaBlockDiagnostics(data: {
    filePath: string;
    fileType: BrunoFileType.RequestFile | BrunoFileType.FolderSettingsFile;
    documentHelper: TextDocumentHelper;
    metaBlock: DictionaryBlock;
}): (DiagnosticWithCode | undefined)[] {
    const { filePath, fileType, documentHelper, metaBlock } = data;
    const mandatoryKeys = getMetaBlockMandatoryKeys(fileType);
    const optionalKeys = getMetaBlockOptionalKeys(fileType);

    if (!mandatoryKeys || !optionalKeys) {
        return [];
    }

    const tagsField = getActiveFieldFromDictionaryBlock(
        metaBlock,
        MetaBlockKey.Tags,
    );

    return [
        checkSequenceInMetaBlockIsValid(metaBlock),
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
            filePath,
            block: metaBlock,
            diagnosticCode:
                RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
            expectedKeys: mandatoryKeys.concat(optionalKeys),
        }) ?? []),
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
        checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
        ...(tagsField && isDictionaryBlockArrayField(tagsField)
            ? runChecksForTagsField(filePath, tagsField)
            : []),
    ];
}
