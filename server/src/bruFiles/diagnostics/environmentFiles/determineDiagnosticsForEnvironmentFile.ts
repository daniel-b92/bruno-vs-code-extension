import {
    TextDocumentHelper,
    parseBruFile,
    EnvironmentFileBlockName,
    isBlockDictionaryBlock,
    BrunoFileType,
    isDictionaryBlockField,
} from "@global_shared";
import { DiagnosticWithCode } from "../interfaces";
import { checkArrayBlocksHaveArrayStructure } from "../shared/checks/multipleBlocks/checkArrayBlocksHaveArrayStructure";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";
import { runDictionaryBlocksBaseChecks } from "../shared/checks/runDictionaryBlocksBaseChecks";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";

export function determineDiagnosticsForEnvironmentFile(
    filePath: string,
    documentText: string,
): DiagnosticWithCode[] {
    const document = new TextDocumentHelper(documentText);

    const { blocks, textOutsideOfBlocks } = parseBruFile(
        document,
        BrunoFileType.EnvironmentFile,
    );
    const blocksThatShouldBeDictionaryBlocks = blocks.filter(
        ({ name }) => name == EnvironmentFileBlockName.Vars,
    );

    const validDictionaryBlocks = blocksThatShouldBeDictionaryBlocks.filter(
        isBlockDictionaryBlock,
    );

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        checkThatNoBlocksAreDefinedMultipleTimes(filePath, blocks),
        checkThatNoTextExistsOutsideOfBlocks(filePath, textOutsideOfBlocks),
        checkNoBlocksHaveUnknownNames(
            filePath,
            blocks,
            Object.values(EnvironmentFileBlockName),
        ),
        checkArrayBlocksHaveArrayStructure(
            filePath,
            blocks.filter(
                ({ name }) => name == EnvironmentFileBlockName.SecretVars,
            ),
        ),
        ...runDictionaryBlocksBaseChecks(
            blocksThatShouldBeDictionaryBlocks,
            validDictionaryBlocks,
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
        ...validDictionaryBlocks.flatMap(
            (block) =>
                checkNoDuplicateKeysAreDefinedForDictionaryBlock({
                    filePath,
                    block,
                    diagnosticCode:
                        RelevantWithinEnvironmentFileDiagnosticCode.EnvironmentVariableDefinedMultipleTimes,
                }) ?? [],
        ),
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}
