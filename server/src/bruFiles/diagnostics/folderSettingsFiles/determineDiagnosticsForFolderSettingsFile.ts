import {
    TextDocumentHelper,
    parseBruFile,
    shouldBeDictionaryBlock,
    SettingsFileSpecificBlock,
    getValidBlockNamesForFolderSettingsFile,
    RequestFileBlockName,
    isAuthBlock,
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
import { checkOccurencesOfMandatoryBlocks } from "./checks/checkOccurencesOfMandatoryBlocks";
import { getMetaBlockSpecificDiagnostics } from "./util/getMetaBlockSpecificDiagnostics";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";
import { checkCodeBlocksHaveClosingBracket } from "../shared/checks/multipleBlocks/checkCodeBlocksHaveClosingBracket";
import { TypedCollectionItemProvider } from "../../../shared";
import { checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType } from "../shared/checks/multipleBlocks/checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { NonBlockSpecificDiagnosticCode } from "../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { runDictionaryBlocksBaseChecks } from "../shared/checks/runDictionaryBlocksBaseChecks";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";

interface BlocksWithSpecificDiagnostics {
    meta?: Block;
    auth?: Block;
    authMode?: Block;
}

export function determineDiagnosticsForFolderSettingsFile(
    filePath: string,
    documentText: string,
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
): DiagnosticWithCode[] {
    const document = new TextDocumentHelper(documentText);
    const itemType = BrunoFileType.FolderSettingsFile;

    const { blocks, textOutsideOfBlocks } = parseBruFile(document, itemType);
    const blocksThatShouldBeDictionaryBlocks = blocks.filter(
        ({ name }) =>
            shouldBeDictionaryBlock(name) ||
            name == SettingsFileSpecificBlock.AuthMode,
    );

    const validDictionaryBlocks = blocksThatShouldBeDictionaryBlocks.filter(
        isBlockDictionaryBlock,
    );
    const { needSpecificDiagnostics, others } =
        determineBlocksRequiringSpecificDiagnostics(blocks);

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        checkOccurencesOfMandatoryBlocks(document, blocks),
        checkThatNoBlocksAreDefinedMultipleTimes(filePath, blocks),
        checkThatNoTextExistsOutsideOfBlocks(filePath, textOutsideOfBlocks),
        checkAuthBlockTypeFromAuthModeBlockExists(filePath, blocks),
        checkAtMostOneAuthBlockExists(filePath, blocks),
        checkNoBlocksHaveUnknownNames(
            filePath,
            blocks,
            Object.values(getValidBlockNamesForFolderSettingsFile()),
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
        checkCodeBlocksHaveClosingBracket(document, blocks, itemType),
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
            collectBlockSpecificDiagnostics({
                blocks: needSpecificDiagnostics,
                documentHelper: document,
                filePath,
                itemProvider,
                relatedFilesHelper,
            }),
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
        .filter((val) => val != undefined);
}

function determineBlocksRequiringSpecificDiagnostics(allBlocks: Block[]): {
    needSpecificDiagnostics: BlocksWithSpecificDiagnostics;
    others: Block[];
} {
    const metaBlocks: Block[] = [];
    const authBlocks: Block[] = [];
    const authModeBlocks: Block[] = [];

    const others = allBlocks.reduce((prev, curr) => {
        if (curr.name == RequestFileBlockName.Meta) {
            metaBlocks.push(curr);
            return prev;
        }
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
            meta: metaBlocks.length == 1 ? metaBlocks[0] : undefined,
            authMode:
                authModeBlocks.length == 1 ? authModeBlocks[0] : undefined,
        },
    };
}

function collectBlockSpecificDiagnostics(data: {
    blocks: BlocksWithSpecificDiagnostics;
    filePath: string;
    documentHelper: TextDocumentHelper;
    itemProvider: TypedCollectionItemProvider;
    relatedFilesHelper: RelatedFilesDiagnosticsHelper;
}) {
    const results: (DiagnosticWithCode | undefined)[] = [];
    const {
        blocks: { auth: authBlock, authMode: authModeBlock, meta: metaBlock },
        filePath: folderSettingsPath,
    } = data;

    if (metaBlock) {
        results.push(
            ...getMetaBlockSpecificDiagnostics({
                ...data,
                metaBlock: metaBlock,
                folderSettingsPath,
            }),
        );
    }
    if (authBlock) {
        results.push(
            ...getAuthBlockSpecificDiagnostics(folderSettingsPath, authBlock),
        );
    }
    if (authModeBlock) {
        results.push(
            ...getAuthModeBlockSpecificDiagnostics(
                folderSettingsPath,
                authModeBlock,
            ),
        );
    }

    return results;
}
