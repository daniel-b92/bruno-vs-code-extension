import { Uri } from "vscode";
import {
    TextDocumentHelper,
    parseBruFile,
    shouldBeDictionaryBlock,
    RequestFileBlockName,
    getAllMethodBlocks,
    isAuthBlock,
    isBodyBlock,
    CollectionItemProvider,
    Block,
    TextOutsideOfBlocks,
} from "../../../../../shared";
import { DiagnosticWithCode } from "../definitions";
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
import { checkEitherAssertOrTestsBlockExists } from "./checks/multipleBlocks/checkEitherAssertOrTestsBlockExists";
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

export async function determineDiagnosticsForRequestFile(
    documentUri: Uri,
    documentText: string,
    itemProvider: CollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
): Promise<DiagnosticWithCode[]> {
    const documentHelper = new TextDocumentHelper(documentText);
    const { blocks, textOutsideOfBlocks } = parseBruFile(documentHelper);

    const results = collectCommonDiagnostics(
        documentUri,
        documentHelper,
        blocks,
        textOutsideOfBlocks,
    ).concat(
        await collectBlockSpecificDiagnostics(
            itemProvider,
            relatedFilesHelper,
            documentUri,
            documentHelper,
            blocks,
        ),
    );

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}

function collectCommonDiagnostics(
    documentUri: Uri,
    documentHelper: TextDocumentHelper,
    blocks: Block[],
    textOutsideOfBlocks: TextOutsideOfBlocks[],
): (DiagnosticWithCode | undefined)[] {
    const blocksThatShouldBeDictionaryBlocks = blocks.filter(({ name }) =>
        shouldBeDictionaryBlock(name),
    );

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        ...checkOccurencesOfMandatoryBlocks(documentHelper, blocks),
        checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
        checkThatNoTextExistsOutsideOfBlocks(documentUri, textOutsideOfBlocks),
        checkAtMostOneAuthBlockExists(documentUri, blocks),
        checkAtMostOneBodyBlockExists(documentUri, blocks),
        checkAuthBlockTypeFromMethodBlockExists(documentUri, blocks),
        checkBodyBlockTypeFromMethodBlockExists(documentUri, blocks),
        checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests(
            documentUri,
            blocks,
        ),
        checkNoBlocksHaveUnknownNames(
            documentUri,
            blocks,
            Object.values(RequestFileBlockName) as string[],
        ),
        checkDictionaryBlocksHaveDictionaryStructure(
            documentUri,
            blocksThatShouldBeDictionaryBlocks,
        ),
        checkDictionaryBlocksAreNotEmpty(
            documentUri,
            blocksThatShouldBeDictionaryBlocks,
        ),
        checkUrlFromMethodBlockMatchesQueryParamsBlock(documentUri, blocks),
        checkUrlFromMethodBlockMatchesPathParamsBlock(documentUri, blocks),
        checkCodeBlocksHaveClosingBracket(documentHelper, blocks),
        checkEitherAssertOrTestsBlockExists(documentHelper, blocks),
        checkBlocksAreSeparatedBySingleEmptyLine(
            documentUri,
            blocks,
            textOutsideOfBlocks,
        ),
    );

    return results;
}

async function collectBlockSpecificDiagnostics(
    itemProvider: CollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
    documentUri: Uri,
    documentHelper: TextDocumentHelper,
    blocks: Block[],
): Promise<(DiagnosticWithCode | undefined)[]> {
    const results: (DiagnosticWithCode | undefined)[] = [];

    const metaBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Meta,
    );

    if (metaBlocks.length == 1) {
        results.push(
            ...(await getMetaBlockSpecificDiagnostics(
                itemProvider,
                relatedFilesHelper,
                documentUri,
                documentHelper,
                metaBlocks[0],
            )),
        );
    }

    const methodBlocks = getAllMethodBlocks(blocks);

    if (methodBlocks.length == 1) {
        results.push(...getMethodBlockSpecificDiagnostics(methodBlocks[0]));
    }

    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (authBlocks.length == 1) {
        results.push(...getAuthBlockSpecificDiagnostics(authBlocks[0]));
    }

    const bodyBlocks = blocks.filter(({ name }) => isBodyBlock(name));

    if (bodyBlocks.length == 1) {
        results.push(...getRequestBodyBlockSpecificDiagnostics(bodyBlocks[0]));
    }

    const settingsBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Settings,
    );

    if (settingsBlocks.length == 1) {
        results.push(...getSettingsBlockSpecificDiagnostics(settingsBlocks[0]));
    }

    return results;
}
