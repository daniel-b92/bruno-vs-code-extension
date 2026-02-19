import {
    TextDocumentHelper,
    parseBruFile,
    shouldBeDictionaryBlock,
    SettingsFileSpecificBlock,
    isAuthBlock,
    getValidBlockNamesForCollectionSettingsFile,
    getNamesForRedundantBlocksForCollectionSettingsFile,
    isBlockDictionaryBlock,
} from "@global_shared";
import { DiagnosticWithCode } from "../interfaces";
import { getAuthBlockSpecificDiagnostics } from "../getAuthBlockSpecificDiagnostics";
import { checkAtMostOneAuthBlockExists } from "../shared/checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAuthBlockTypeFromAuthModeBlockExists } from "../shared/checks/multipleBlocks/checkAuthBlockTypeFromAuthModeBlockExists";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "../shared/checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { checkDictionaryBlocksAreNotEmpty } from "../shared/checks/multipleBlocks/checkDictionaryBlocksAreNotEmpty";
import { checkDictionaryBlocksHaveDictionaryStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { getAuthModeBlockSpecificDiagnostics } from "../shared/checks/multipleBlocks/getAuthModeBlockSpecificDiagnostics";
import { checkNoRedundantBlocksExist } from "../shared/checks/multipleBlocks/checkNoRedundantBlocksExist";
import { checkCodeBlocksHaveClosingBracket } from "../shared/checks/multipleBlocks/checkCodeBlocksHaveClosingBracket";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";

export function determineDiagnosticsForCollectionSettingsFile(
    filePath: string,
    documentText: string,
): DiagnosticWithCode[] {
    const document = new TextDocumentHelper(documentText);

    const { blocks, textOutsideOfBlocks } = parseBruFile(document);

    const blocksThatShouldBeDictionaryBlocks = blocks.filter(({ name }) =>
        shouldBeDictionaryBlock(name),
    );

    const validDictionaryBlocks = blocksThatShouldBeDictionaryBlocks.filter(
        isBlockDictionaryBlock,
    );

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        checkThatNoBlocksAreDefinedMultipleTimes(filePath, blocks),
        checkThatNoTextExistsOutsideOfBlocks(filePath, textOutsideOfBlocks),
        checkAuthBlockTypeFromAuthModeBlockExists(filePath, blocks),
        checkAtMostOneAuthBlockExists(filePath, blocks),
        checkNoBlocksHaveUnknownNames(
            filePath,
            blocks,
            getValidBlockNamesForCollectionSettingsFile().concat(
                getNamesForRedundantBlocksForCollectionSettingsFile(),
            ),
        ),
        checkNoRedundantBlocksExist(
            filePath,
            blocks,
            getNamesForRedundantBlocksForCollectionSettingsFile(),
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
        checkCodeBlocksHaveClosingBracket(document, blocks),
        checkDictionaryBlocksAreNotEmpty(
            filePath,
            blocksThatShouldBeDictionaryBlocks,
        ),
        checkBlocksAreSeparatedBySingleEmptyLine(
            filePath,
            blocks,
            textOutsideOfBlocks,
        ),
    );

    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (authBlocks.length == 1) {
        results.push(
            ...getAuthBlockSpecificDiagnostics(filePath, authBlocks[0]),
        );
    }

    const authModeBlocks = blocks.filter(
        ({ name }) => name == SettingsFileSpecificBlock.AuthMode,
    );

    if (authModeBlocks.length == 1) {
        results.push(
            ...getAuthModeBlockSpecificDiagnostics(filePath, authModeBlocks[0]),
        );
    }

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}
