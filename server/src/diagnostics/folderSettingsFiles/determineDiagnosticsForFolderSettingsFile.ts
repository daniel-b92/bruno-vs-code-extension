import { Uri } from "vscode";
import {
    TextDocumentHelper,
    parseBruFile,
    shouldBeDictionaryBlock,
    SettingsFileSpecificBlock,
    getValidBlockNamesForFolderSettingsFile,
    RequestFileBlockName,
    isAuthBlock,
    CollectionItemProvider,
} from "../../../../shared";
import { DiagnosticWithCode } from "../definitions";
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
import { checkOccurencesOfMandatoryBlocks } from "./checks/checkOccurencesOfMandatoryBlocks";
import { getMetaBlockSpecificDiagnostics } from "./util/getMetaBlockSpecificDiagnostics";
import { RelatedFilesDiagnosticsHelper } from "../shared/helpers/relatedFilesDiagnosticsHelper";

export async function determineDiagnosticsForFolderSettingsFile(
    documentUri: Uri,
    documentText: string,
    itemProvider: CollectionItemProvider,
    relatedFilesHelper: RelatedFilesDiagnosticsHelper,
): Promise<DiagnosticWithCode[]> {
    const document = new TextDocumentHelper(documentText);

    const { blocks, textOutsideOfBlocks } = parseBruFile(document);
    const blocksThatShouldBeDictionaryBlocks = blocks.filter(
        ({ name }) =>
            shouldBeDictionaryBlock(name) ||
            name == SettingsFileSpecificBlock.AuthMode,
    );

    const results: (DiagnosticWithCode | undefined)[] = [];

    results.push(
        checkOccurencesOfMandatoryBlocks(document, blocks),
        checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
        checkThatNoTextExistsOutsideOfBlocks(documentUri, textOutsideOfBlocks),
        checkAuthBlockTypeFromAuthModeBlockExists(documentUri, blocks),
        checkAtMostOneAuthBlockExists(documentUri, blocks),
        checkNoBlocksHaveUnknownNames(
            documentUri,
            blocks,
            Object.values(getValidBlockNamesForFolderSettingsFile()),
        ),
        checkDictionaryBlocksHaveDictionaryStructure(
            documentUri,
            blocksThatShouldBeDictionaryBlocks,
        ),
        checkDictionaryBlocksAreNotEmpty(
            documentUri,
            blocksThatShouldBeDictionaryBlocks,
        ),
        checkBlocksAreSeparatedBySingleEmptyLine(
            documentUri,
            textOutsideOfBlocks,
        ),
    );

    const metaBlocks = blocks.filter(
        ({ name }) => name == RequestFileBlockName.Meta,
    );

    if (metaBlocks.length == 1) {
        results.push(
            ...(await getMetaBlockSpecificDiagnostics(
                itemProvider,
                relatedFilesHelper,
                documentUri,
                document,
                metaBlocks[0],
            )),
        );
    }

    const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

    if (authBlocks.length == 1) {
        results.push(...getAuthBlockSpecificDiagnostics(authBlocks[0]));
    }

    const authModeBlocks = blocks.filter(
        ({ name }) => name == SettingsFileSpecificBlock.AuthMode,
    );

    if (authModeBlocks.length == 1) {
        results.push(...getAuthModeBlockSpecificDiagnostics(authModeBlocks[0]));
    }

    return results.filter((val) => val != undefined) as DiagnosticWithCode[];
}
