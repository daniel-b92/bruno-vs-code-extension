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
    const appBlockAsDictionaryBlock = validDictionaryBlocks.find(
        ({ name }) => name == appFileSpecificBlocks.app,
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
        appBlockAsDictionaryBlock
            ? runAppBlockSpecificChecks(appBlockAsDictionaryBlock, filePath)
            : undefined,
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
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
