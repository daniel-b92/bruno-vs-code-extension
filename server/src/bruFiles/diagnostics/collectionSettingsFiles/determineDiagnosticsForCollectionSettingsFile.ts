import {
    TextDocumentHelper,
    parseBruFile,
    shouldBeDictionaryBlock,
    SettingsFileSpecificBlock,
    isAuthBlock,
    getValidBlockNamesForCollectionSettingsFile,
    getNamesForRedundantBlocksForCollectionSettingsFile,
    isBlockDictionaryBlock,
    BrunoFileType,
    Block,
    isDictionaryBlockField,
} from "@global_shared";
import { DiagnosticWithCode } from "../interfaces";
import { getAuthBlockSpecificDiagnostics } from "../getAuthBlockSpecificDiagnostics";
import { checkAtMostOneAuthBlockExists } from "../shared/checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAuthBlockTypeFromAuthModeBlockExists } from "../shared/checks/multipleBlocks/checkAuthBlockTypeFromAuthModeBlockExists";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "../shared/checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { getAuthModeBlockSpecificDiagnostics } from "../shared/checks/multipleBlocks/getAuthModeBlockSpecificDiagnostics";
import { checkNoRedundantBlocksExist } from "../shared/checks/multipleBlocks/checkNoRedundantBlocksExist";
import { checkCodeBlocksHaveClosingBracket } from "../shared/checks/multipleBlocks/checkCodeBlocksHaveClosingBracket";
import { checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType } from "../shared/checks/multipleBlocks/checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { NonBlockSpecificDiagnosticCode } from "../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { runDictionaryBlocksBaseChecks } from "../shared/checks/runDictionaryBlocksBaseChecks";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";

interface BlocksWithSpecificDiagnostics {
    auth?: Block;
    authMode?: Block;
}

export function determineDiagnosticsForCollectionSettingsFile(
    filePath: string,
    documentText: string,
): DiagnosticWithCode[] {
    const docHelper = new TextDocumentHelper(documentText);
    const itemType = BrunoFileType.CollectionSettingsFile;

    const { blocks, textOutsideOfBlocks } = parseBruFile(docHelper, itemType);

    const blocksThatShouldBeDictionaryBlocks = blocks.filter(({ name }) =>
        shouldBeDictionaryBlock(name),
    );

    const validDictionaryBlocks = blocksThatShouldBeDictionaryBlocks.filter(
        isBlockDictionaryBlock,
    );
    const { needSpecificDiagnostics, others } =
        determineBlocksRequiringSpecificDiagnostics(blocks);

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
        checkCodeBlocksHaveClosingBracket(docHelper, blocks, itemType),
        checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType(
            filePath,
            blocks,
        ),
        checkBlocksAreSeparatedBySingleEmptyLine(
            filePath,
            blocks,
            textOutsideOfBlocks,
        ),
    );

    return results
        .concat(
            collectBlockSpecificDiagnostics(needSpecificDiagnostics, filePath),
            others.flatMap((block) =>
                isBlockDictionaryBlock(block)
                    ? checkNoDuplicateKeysAreDefinedForDictionaryBlock({
                          block,
                          diagnosticCode:
                              NonBlockSpecificDiagnosticCode.MultipleDefinitionsForSameKeyInDictionaryBlock,
                          filePath,
                      })
                    : [],
            ),
        )
        .filter((val) => val != undefined) as DiagnosticWithCode[];
}

function determineBlocksRequiringSpecificDiagnostics(allBlocks: Block[]): {
    needSpecificDiagnostics: BlocksWithSpecificDiagnostics;
    others: Block[];
} {
    const authBlocks: Block[] = [];
    const authModeBlocks: Block[] = [];

    const others = allBlocks.reduce((prev, curr) => {
        if (isAuthBlock(curr.name)) {
            authBlocks.push(curr);
            return prev;
        }
        if (curr.name == SettingsFileSpecificBlock.AuthMode) {
            authModeBlocks.push(curr);
            return prev;
        }

        return prev.concat(curr);
    }, [] as Block[]);

    return {
        others,
        needSpecificDiagnostics: {
            auth: authBlocks.length == 1 ? authBlocks[0] : undefined,
            authMode:
                authModeBlocks.length == 1 ? authModeBlocks[0] : undefined,
        },
    };
}

function collectBlockSpecificDiagnostics(
    { auth: authBlock, authMode: authModeBlock }: BlocksWithSpecificDiagnostics,
    filePath: string,
) {
    const results: (DiagnosticWithCode | undefined)[] = [];
    if (authBlock) {
        results.push(...getAuthBlockSpecificDiagnostics(filePath, authBlock));
    }
    if (authModeBlock) {
        results.push(
            ...getAuthModeBlockSpecificDiagnostics(filePath, authModeBlock),
        );
    }
    return results;
}
