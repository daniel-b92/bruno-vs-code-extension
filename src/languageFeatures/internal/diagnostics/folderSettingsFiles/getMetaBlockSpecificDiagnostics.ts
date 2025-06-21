import {
    TextDocumentHelper,
    Block,
    castBlockToDictionaryBlock,
    MetaBlockKey,
} from "../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkMetaBlockStartsInFirstLine } from "../shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";
import { DiagnosticWithCode } from "../definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { checkSequenceInMetaBlockIsValid } from "../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";

export function getMetaBlockSpecificDiagnostics(
    documentHelper: TextDocumentHelper,
    metaBlock: Block
): (DiagnosticWithCode | undefined)[] {
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

    // ToDo: add diagnostics if other folder settings with same parent folder have same sequence, see diagnostics for sequence in  request files.

    return diagnostics;
}
