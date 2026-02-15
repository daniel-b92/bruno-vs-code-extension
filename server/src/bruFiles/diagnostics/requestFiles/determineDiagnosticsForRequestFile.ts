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
} from "@global_shared";
import { TypedCollectionItemProvider } from "../../../shared";
import { DiagnosticWithCode } from "../interfaces";
import { getAuthBlockSpecificDiagnostics } from "../getAuthBlockSpecificDiagnostics";
import { checkAtMostOneAuthBlockExists } from "../shared/checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "../shared/checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { checkDictionaryBlocksAreNotEmpty } from "../shared/checks/multipleBlocks/checkDictionaryBlocksAreNotEmpty";
import { checkDictionaryBlocksHaveDictionaryStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
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
import { getRequestBodyBlockSpecificDiagnostics } from "./getRequestBodyBlockSpecificDiagnostics";
import { checkOccurencesOfMandatoryBlocks } from "./checks/multipleBlocks/checkOccurencesOfMandatoryBlocks";
import { getMetaBlockSpecificDiagnostics } from "./getMetaBlockSpecificDiagnostics";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";
import { getSettingsBlockSpecificDiagnostics } from "./getSettingsBlockSpecificDiagnostics";
import { checkCodeBlocksHaveClosingBracket } from "../shared/checks/multipleBlocks/checkCodeBlocksHaveClosingBracket";
import { checkDictionaryBlocksSimpleFieldsStructure } from "../shared/checks/multipleBlocks/checkDictionaryBlocksSimpleFieldsStructure";

export async function determineDiagnosticsForRequestFile(
    filePath: string,
    documentText: string,
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
): Promise<DiagnosticWithCode[]> {
    const documentHelper = new TextDocumentHelper(documentText);
    const { blocks, textOutsideOfBlocks } = parseBruFile(documentHelper);

    const results = collectCommonDiagnostics(
        filePath,
        documentHelper,
        blocks,
        textOutsideOfBlocks,
    ).concat(
        await collectBlockSpecificDiagnostics(
            itemProvider,
            relatedFilesHelper,
            filePath,
            documentHelper,
            blocks,
        ),
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}

function collectCommonDiagnostics(
    filePath: string,
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
        validDictionaryBlocks.length < blocksThatShouldBeDictionaryBlocks.length
            ? checkDictionaryBlocksHaveDictionaryStructure(
                  filePath,
                  blocksThatShouldBeDictionaryBlocks,
              )
            : undefined,
        checkDictionaryBlocksSimpleFieldsStructure(
            filePath,
            getDictionaryBlockFieldsThatShouldBeSimpleFields(
                validDictionaryBlocks,
            ),
        ),
        checkDictionaryBlocksAreNotEmpty(
            filePath,
            blocksThatShouldBeDictionaryBlocks,
        ),
        checkUrlFromMethodBlockMatchesQueryParamsBlock(filePath, blocks),
        checkUrlFromMethodBlockMatchesPathParamsBlock(filePath, blocks),
        checkCodeBlocksHaveClosingBracket(documentHelper, blocks),
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

async function collectBlockSpecificDiagnostics(
    itemProvider: TypedCollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    filePath: string,
    documentHelper: TextDocumentHelper,
    blocks: Block[],
): Promise<(DiagnosticWithCode | undefined)[]> {
    const results: (DiagnosticWithCode | undefined)[] = [];

    const metaBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Meta,
    );

    if (metaBlocks.length == 1) {
        const metaBlock = metaBlocks[0];

        if (isBlockDictionaryBlock(metaBlock)) {
            results.push(
                ...(await getMetaBlockSpecificDiagnostics(
                    itemProvider,
                    relatedFilesHelper,
                    filePath,
                    documentHelper,
                    metaBlock,
                )),
            );
        }
    }

    const methodBlocks = getAllMethodBlocks(blocks);

    if (methodBlocks.length == 1) {
        results.push(
            ...getMethodBlockSpecificDiagnostics(filePath, methodBlocks[0]),
        );
    }

    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (authBlocks.length == 1) {
        results.push(
            ...getAuthBlockSpecificDiagnostics(filePath, authBlocks[0]),
        );
    }

    const bodyBlocks = blocks.filter(({ name }) => isBodyBlock(name));

    if (bodyBlocks.length == 1) {
        results.push(...getRequestBodyBlockSpecificDiagnostics(bodyBlocks[0]));
    }

    const settingsBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Settings,
    );

    if (settingsBlocks.length == 1) {
        results.push(
            ...getSettingsBlockSpecificDiagnostics(filePath, settingsBlocks[0]),
        );
    }

    return results;
}
