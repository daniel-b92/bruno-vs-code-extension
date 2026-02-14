import {
    TextDocumentHelper,
    parseBruFile,
    EnvironmentFileBlockName,
    isBlockDictionaryBlock,
} from "@global_shared";
import { DiagnosticWithCode } from "../interfaces";
import { checkArrayBlocksHaveArrayStructure } from "../shared/checks/multipleBlocks/checkArrayBlocksHaveArrayStructure";
import { checkDictionaryBlocksAreNotEmpty } from "../shared/checks/multipleBlocks/checkDictionaryBlocksAreNotEmpty";
import { checkDictionaryBlocksHaveDictionaryStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { RelevantWithinEnvironmentFileDiagnosticCode } from "../shared/diagnosticCodes/relevantWithinEnvironmentFileDiagnosticCodeEnum";

export function determineDiagnosticsForEnvironmentFile(
    filePath: string,
    documentText: string,
): DiagnosticWithCode[] {
    const document = new TextDocumentHelper(documentText);

    const { blocks, textOutsideOfBlocks } = parseBruFile(document);
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
        validDictionaryBlocks.length < blocksThatShouldBeDictionaryBlocks.length
            ? checkDictionaryBlocksHaveDictionaryStructure(
                  filePath,
                  blocksThatShouldBeDictionaryBlocks,
              )
            : undefined,
        checkDictionaryBlocksSimpleFieldsStructure(
            filePath,
            validDictionaryBlocks.map((block) => ({
                block,
                keys: block.content.map(({ key }) => key),
            })),
        ),
        checkDictionaryBlocksAreNotEmpty(
            filePath,
            blocksThatShouldBeDictionaryBlocks,
        ),
        ...validDictionaryBlocks.flatMap(
            (block) =>
                checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                    filePath,
                    block,
                    RelevantWithinEnvironmentFileDiagnosticCode.EnvironmentVariableDefinedMultipleTimes,
                ) ?? [],
        ),
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}
