import {
    TextDocumentHelper,
    parseBruFile,
    shouldBeDictionaryBlock,
    RequestFileBlockName,
    getAllMethodBlocks,
    isAuthBlock,
    isBodyBlock,
    Block,
    TextOutsideOfBlocks,
    isBlockDictionaryBlock,
    DictionaryBlock,
    shouldBeDictionaryArrayField,
    getGraphQlSpecificBlocks,
    BrunoFileType,
    ItemType,
    isDictionaryBlockField,
} from "@global_shared";
import { TypedCollectionItemProvider } from "../../../shared";
import { DiagnosticWithCode } from "../interfaces";
import { getAuthBlockSpecificDiagnostics } from "../getAuthBlockSpecificDiagnostics";
import { checkAtMostOneAuthBlockExists } from "../shared/checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "../shared/checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { checkNoBlocksHaveUnknownNames } from "../shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "../shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "../shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneBodyBlockExists } from "./checks/multipleBlocks/checkAtMostOneBodyBlockExists";
import { checkAuthBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkAuthBlockTypeFromMethodBlockExists";
import { checkBodyBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkBodyBlockTypeFromMethodBlockExists";
import { checkBlockForResponseValidationExists } from "./checks/multipleBlocks/checkBlockForResponseValidationExists";
import { checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests } from "./checks/multipleBlocks/checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests";
import { checkUrlFromMethodBlockMatchesPathParamsBlock } from "./checks/multipleBlocks/checkUrlFromMethodBlockMatchesPathParamsBlock";
import { checkUrlFromMethodBlockMatchesQueryParamsBlock } from "./checks/multipleBlocks/checkUrlFromMethodBlockMatchesQueryParamsBlock";
import { getMethodBlockSpecificDiagnostics } from "./getMethodBlockSpecificDiagnostics";
import { getRequestBodyOrGraphQlBlockSpecificDiagnostics } from "./getRequestBodyOrGraphQlBlockSpecificDiagnostics";
import { checkOccurencesOfMandatoryBlocks } from "./checks/multipleBlocks/checkOccurencesOfMandatoryBlocks";
import { getMetaBlockSpecificDiagnostics } from "./getMetaBlockSpecificDiagnostics";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";
import { getSettingsBlockSpecificDiagnostics } from "./getSettingsBlockSpecificDiagnostics";
import { checkCodeBlocksHaveClosingBracket } from "../shared/checks/multipleBlocks/checkCodeBlocksHaveClosingBracket";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";
import { checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType } from "../shared/checks/multipleBlocks/checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType";
import { getAppBlockSpecificDiagnostics } from "./getAppBlockSpecificDiagnostics";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "../shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { NonBlockSpecificDiagnosticCode } from "../shared/diagnosticCodes/nonBlockSpecificDiagnosticCodeEnum";
import { runDictionaryBlocksBaseChecks } from "../shared/checks/runDictionaryBlocksBaseChecks";

interface BlocksWithSpecificDiagnostics {
    meta?: Block;
    method?: Block;
    auth?: Block;
    body?: Block;
    graphQlSpecific: Block[];
    settings?: Block;
    app?: Block;
}

export function determineDiagnosticsForRequestFile(
    filePath: string,
    documentText: string,
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
): DiagnosticWithCode[] {
    const documentHelper = new TextDocumentHelper(documentText);
    const itemType = BrunoFileType.RequestFile;
    const { blocks, textOutsideOfBlocks } = parseBruFile(
        documentHelper,
        itemType,
    );
    const { needSpecificDiagnostics, others } =
        determineBlocksRequiringSpecificDiagnostics(blocks);

    const results = collectCommonDiagnostics(
        filePath,
        itemType,
        documentHelper,
        blocks,
        textOutsideOfBlocks,
    ).concat(
        collectBlockSpecificDiagnostics(
            itemProvider,
            relatedFilesHelper,
            filePath,
            documentHelper,
            needSpecificDiagnostics,
        ),
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
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}

function determineBlocksRequiringSpecificDiagnostics(allBlocks: Block[]): {
    needSpecificDiagnostics: BlocksWithSpecificDiagnostics;
    others: Block[];
} {
    const metaBlocks: Block[] = [];
    const methodBlocks: Block[] = [];
    const authBlocks: Block[] = [];
    const bodyBlocks: Block[] = [];
    const graphQlSpecific: Block[] = [];
    const settingsBlocks: Block[] = [];
    const appBlocks: Block[] = [];

    const graphQlSpecificBlockNames = getGraphQlSpecificBlocks() as string[];

    const others = allBlocks.reduce((prev, curr) => {
        if (curr.name == RequestFileBlockName.Meta) {
            metaBlocks.push(curr);
            return prev;
        }
        if (getAllMethodBlocks([curr]).length > 0) {
            methodBlocks.push(curr);
            return prev;
        }
        if (isAuthBlock(curr.name)) {
            authBlocks.push(curr);
            return prev;
        }
        if (isBodyBlock(curr.name)) {
            bodyBlocks.push(curr);
            return prev;
        }
        if (graphQlSpecificBlockNames.includes(curr.name)) {
            graphQlSpecific.push(curr);
            return prev;
        }
        if (curr.name == RequestFileBlockName.Settings) {
            settingsBlocks.push(curr);
            return prev;
        }
        if (curr.name == RequestFileBlockName.App) {
            appBlocks.push(curr);
            return prev;
        }

        return prev.concat(curr);
    }, [] as Block[]);

    return {
        others,
        needSpecificDiagnostics: {
            graphQlSpecific,
            app: appBlocks.length == 1 ? appBlocks[0] : undefined,
            auth: authBlocks.length == 1 ? authBlocks[0] : undefined,
            body: bodyBlocks.length == 1 ? bodyBlocks[0] : undefined,
            meta: metaBlocks.length == 1 ? metaBlocks[0] : undefined,
            method: methodBlocks.length == 1 ? methodBlocks[0] : undefined,
            settings:
                settingsBlocks.length == 1 ? settingsBlocks[0] : undefined,
        },
    };
}

function collectCommonDiagnostics(
    filePath: string,
    itemType: ItemType,
    documentHelper: TextDocumentHelper,
    blocks: Block[],
    textOutsideOfBlocks: TextOutsideOfBlocks[],
): (DiagnosticWithCode | undefined)[] {
    const blocksThatShouldBeDictionaryBlocks = blocks.filter(({ name }) =>
        shouldBeDictionaryBlock(name),
    );

    const validDictionaryBlocks = blocksThatShouldBeDictionaryBlocks.filter(
        isBlockDictionaryBlock,
    );

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        ...checkOccurencesOfMandatoryBlocks(documentHelper, blocks),
        checkThatNoBlocksAreDefinedMultipleTimes(filePath, blocks),
        checkThatNoTextExistsOutsideOfBlocks(filePath, textOutsideOfBlocks),
        checkAtMostOneAuthBlockExists(filePath, blocks),
        checkAtMostOneBodyBlockExists(filePath, blocks),
        checkAuthBlockTypeFromMethodBlockExists(filePath, blocks),
        checkBodyBlockTypeFromMethodBlockExists(filePath, blocks),
        checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests(
            filePath,
            blocks,
        ),
        checkNoBlocksHaveUnknownNames(
            filePath,
            blocks,
            Object.values(RequestFileBlockName) as string[],
        ),
        ...runDictionaryBlocksBaseChecks(
            blocksThatShouldBeDictionaryBlocks,
            validDictionaryBlocks,
            documentHelper,
            filePath,
        ),
        checkDictionaryBlocksSimpleFieldsStructure(
            filePath,
            getDictionaryBlockFieldsThatShouldBeSimpleFields(
                validDictionaryBlocks,
            ),
        ),
        checkUrlFromMethodBlockMatchesQueryParamsBlock(filePath, blocks),
        checkUrlFromMethodBlockMatchesPathParamsBlock(filePath, blocks),
        checkCodeBlocksHaveClosingBracket(documentHelper, blocks, itemType),
        checkOAuth2AdditionalParamsBlocksOnlyExistForMatchingAuthType(
            filePath,
            blocks,
        ),
        checkBlockForResponseValidationExists(documentHelper, blocks),
        checkBlocksAreSeparatedBySingleEmptyLine(
            filePath,
            blocks,
            textOutsideOfBlocks,
        ),
    );

    return results;
}

function getDictionaryBlockFieldsThatShouldBeSimpleFields(
    dictionaryBlocks: DictionaryBlock[],
) {
    return dictionaryBlocks
        .map((block) => {
            const keysToCheck = block.content
                .filter(isDictionaryBlockField)
                .map(({ key }) => key)
                .filter(
                    (key) => !shouldBeDictionaryArrayField(block.name, key),
                );

            return keysToCheck.length > 0
                ? {
                      block,
                      keys: keysToCheck,
                  }
                : undefined;
        })
        .filter((val) => val != undefined);
}

function collectBlockSpecificDiagnostics(
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    filePath: string,
    documentHelper: TextDocumentHelper,
    {
        graphQlSpecific: graphQlSpecificBlocks,
        app: appBlock,
        auth: authBlock,
        body: bodyBlock,
        meta: metaBlock,
        method: methodBlock,
        settings: settingsBlock,
    }: BlocksWithSpecificDiagnostics,
): (DiagnosticWithCode | undefined)[] {
    const results: (DiagnosticWithCode | undefined)[] = [];

    if (metaBlock && isBlockDictionaryBlock(metaBlock)) {
        results.push(
            ...getMetaBlockSpecificDiagnostics({
                itemProvider,
                relatedFilesHelper,
                filePath,
                documentHelper,
                metaBlock,
            }),
        );
    }
    if (methodBlock) {
        results.push(
            ...getMethodBlockSpecificDiagnostics(filePath, methodBlock),
        );
    }
    if (authBlock) {
        results.push(...getAuthBlockSpecificDiagnostics(filePath, authBlock));
    }
    if (bodyBlock) {
        results.push(
            ...getRequestBodyOrGraphQlBlockSpecificDiagnostics(bodyBlock),
        );
    }
    if (graphQlSpecificBlocks.length > 0) {
        results.push(
            ...graphQlSpecificBlocks.flatMap((block) =>
                getRequestBodyOrGraphQlBlockSpecificDiagnostics(block),
            ),
        );
    }
    if (settingsBlock) {
        results.push(
            ...getSettingsBlockSpecificDiagnostics(filePath, settingsBlock),
        );
    }
    if (appBlock) {
        results.push(...getAppBlockSpecificDiagnostics(filePath, appBlock));
    }

    return results;
}
