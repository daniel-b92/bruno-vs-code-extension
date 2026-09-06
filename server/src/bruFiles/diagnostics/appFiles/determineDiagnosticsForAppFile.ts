import {
    TextDocumentHelper,
    parseBruFile,
    shouldBeDictionaryBlock,
    isBlockDictionaryBlock,
    BrunoFileType,
    isDictionaryBlockField,
    getValidAppFileBlockNames,
    DictionaryBlock,
    AppBlockInAppFileKey,
    appFileSpecificBlocks,
    Block,
    getMetaBlockMandatoryKeys,
    MetaBlockKey,
    RequestFileBlockName,
} from "@global_shared";
import { DiagnosticWithCode } from "../interfaces";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "../shared/checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { runDictionaryBlocksBaseChecks } from "../shared/checks/runDictionaryBlocksBaseChecks";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";
import { checkNoKeysAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { RelevantWithinCodeBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinCodeBlockDiagnosticCodeEnum";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "../shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkSequenceInMetaBlockIsValid } from "../shared/checks/singleBlocks/checkSequenceInMetaBlockIsValid";
import { RelevantWithinMetaBlockDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";
import { checkMetaBlockStartsInFirstLine } from "../shared/checks/singleBlocks/checkMetaBlockStartsInFirstLine";

export function determineDiagnosticsForAppFile(
    filePath: string,
    documentText: string,
): DiagnosticWithCode[] {
    const docHelper = new TextDocumentHelper(documentText);
    const itemType = BrunoFileType.AppFile;

    const { blocks, textOutsideOfBlocks } = parseBruFile(docHelper, itemType);

    const blocksThatShouldBeDictionaryBlocks = blocks.filter(({ name }) =>
        shouldBeDictionaryBlock(name),
    );

    const validDictionaryBlocks = blocksThatShouldBeDictionaryBlocks.filter(
        isBlockDictionaryBlock,
    );
    const appBlocksAsDictionaryBlocks = validDictionaryBlocks.filter(
        ({ name }) => name == appFileSpecificBlocks.app,
    );
    const metaBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Meta,
    );

    const results = [
        checkThatNoBlocksAreDefinedMultipleTimes(filePath, blocks),
    ].concat(
        checkThatNoTextExistsOutsideOfBlocks(filePath, textOutsideOfBlocks),
        checkNoBlocksHaveUnknownNames(
            filePath,
            blocks,
            getValidAppFileBlockNames(),
        ),
        ...runDictionaryBlocksBaseChecks(
            blocksThatShouldBeDictionaryBlocks,
            validDictionaryBlocks,
            docHelper,
            filePath,
        ),
        checkDictionaryBlocksSimpleFieldsStructure(
            filePath,
            validDictionaryBlocks.map((block) => ({
                block,
                keys: block.content
                    .filter(isDictionaryBlockField)
                    .map(({ key }) => key),
            })),
        ),
        checkBlocksAreSeparatedBySingleEmptyLine(
            filePath,
            blocks,
            textOutsideOfBlocks,
        ),
        appBlocksAsDictionaryBlocks.length == 1
            ? runAppBlockSpecificChecks(
                  appBlocksAsDictionaryBlocks[0],
                  filePath,
              )
            : undefined,
        metaBlocks.length == 1
            ? getMetaBlockSpecificDiagnostics({
                  documentHelper: docHelper,
                  filePath,
                  metaBlock: metaBlocks[0],
              })
            : undefined,
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}

function getMetaBlockSpecificDiagnostics(data: {
    filePath: string;
    documentHelper: TextDocumentHelper;
    metaBlock: Block;
}): (DiagnosticWithCode | undefined)[] {
    const { documentHelper, filePath, metaBlock } = data;
    const expectedKeys = getMetaBlockMandatoryKeys(BrunoFileType.AppFile);

    if (!expectedKeys) {
        return [];
    }

    const diagnostics: (DiagnosticWithCode | undefined)[] = [];
    diagnostics.push(checkSequenceInMetaBlockIsValid(metaBlock));

    if (!isBlockDictionaryBlock(metaBlock)) {
        return diagnostics;
    }

    return diagnostics.concat(
        checkNoKeysAreMissingForDictionaryBlock(
            metaBlock,
            expectedKeys,
            RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            metaBlock,
            expectedKeys,
            RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock,
        ),
        checkNoMandatoryValuesAreMissingForDictionaryBlock(
            metaBlock,
            [MetaBlockKey.Name],
            RelevantWithinMetaBlockDiagnosticCode.MandatoryValuesMissingInMetaBlock,
        ),
        checkNoDuplicateKeysAreDefinedForDictionaryBlock({
            filePath: filePath,
            block: metaBlock,
            diagnosticCode:
                RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
            expectedKeys: expectedKeys,
        }) ?? [],
        checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
    );
}

function runAppBlockSpecificChecks(
    appBlock: DictionaryBlock,
    filePath: string,
) {
    const mandatoryKeys = Object.values(AppBlockInAppFileKey);
    return [
        checkNoKeysAreMissingForDictionaryBlock(
            appBlock,
            mandatoryKeys,
            RelevantWithinCodeBlockDiagnosticCode.KeysMissingInCodeBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            appBlock,
            mandatoryKeys,
            RelevantWithinCodeBlockDiagnosticCode.UnknownKeysDefinedInCodeBlock,
        ),
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock({
            block: appBlock,
            filePath,
            diagnosticCode:
                RelevantWithinCodeBlockDiagnosticCode.DuplicateKeysDefinedInCodeBlock,
            expectedKeys: mandatoryKeys,
        }) ?? []),
    ];
}
