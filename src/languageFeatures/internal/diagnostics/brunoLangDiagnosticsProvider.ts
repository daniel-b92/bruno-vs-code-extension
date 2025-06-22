import { DiagnosticCollection, Uri } from "vscode";
import {
    CollectionItemProvider,
    EnvironmentFileBlockName,
    FolderSettingsSpecificBlock,
    getAllMethodBlocks,
    getValidBlockNamesForFolderSettingsFiles,
    isAuthBlock,
    isBodyBlock,
    parseBruFile,
    RequestFileBlockName,
    shouldBeDictionaryBlock,
    TextDocumentHelper,
} from "../../../shared";
import { checkOccurencesOfMandatoryBlocks as checkOccurencesOfMandatoryBlocksForRequestFile } from "./requestFiles/checks/multipleBlocks/checkOccurencesOfMandatoryBlocks";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "./shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "./shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneAuthBlockExists } from "./shared/checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAtMostOneBodyBlockExists } from "./requestFiles/checks/multipleBlocks/checkAtMostOneBodyBlockExists";
import { RelatedFilesDiagnosticsHelper } from "./shared/helpers/relatedFilesDiagnosticsHelper";
import { checkBodyBlockTypeFromMethodBlockExists } from "./requestFiles/checks/multipleBlocks/checkBodyBlockTypeFromMethodBlockExists";
import { checkAuthBlockTypeFromMethodBlockExists } from "./requestFiles/checks/multipleBlocks/checkAuthBlockTypeFromMethodBlockExists";
import { checkNoBlocksHaveUnknownNames } from "./shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkDictionaryBlocksHaveDictionaryStructure } from "./shared/checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { DiagnosticWithCode } from "./definitions";
import { checkEitherAssertOrTestsBlockExists } from "./requestFiles/checks/multipleBlocks/checkEitherAssertOrTestsBlockExists";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "./shared/checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { getMetaBlockSpecificDiagnostics as getMetaBlockSpecificDiagnosticsForRequestFile } from "./requestFiles/getMetaBlockSpecificDiagnostics";
import { getMethodBlockSpecificDiagnostics } from "./requestFiles/getMethodBlockSpecificDiagnostics";
import { getAuthBlockSpecificDiagnostics } from "./getAuthBlockSpecificDiagnostics";
import { checkUrlFromMethodBlockMatchesQueryParamsBlock } from "./requestFiles/checks/multipleBlocks/checkUrlFromMethodBlockMatchesQueryParamsBlock";
import { checkUrlFromMethodBlockMatchesPathParamsBlock } from "./requestFiles/checks/multipleBlocks/checkUrlFromMethodBlockMatchesPathParamsBlock";
import { checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests } from "./requestFiles/checks/multipleBlocks/checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests";
import { checkArrayBlocksHaveArrayStructure } from "./shared/checks/multipleBlocks/checkArrayBlocksHaveArrayStructure";
import { getRequestBodyBlockSpecificDiagnostics } from "./requestFiles/getRequestBodyBlockSpecificDiagnostics";
import { checkOccurencesOfMandatoryBlocks as checkOccurencesOfMandatoryBlocksForFolderSettingsFile } from "./folderSettingsFiles/checkOccurencesOfMandatoryBlocks";
import { getMetaBlockSpecificDiagnostics as getMetaBlockSpecificDiagnosticsForFolderSettings } from "./folderSettingsFiles/getMetaBlockSpecificDiagnostics";
import { getAuthModeBlockSpecificDiagnostics } from "./folderSettingsFiles/getAuthModeBlockSpecificDiagnostics";
import { checkDictionaryBlocksAreNotEmpty } from "./shared/checks/multipleBlocks/checkDictionaryBlocksAreNotEmpty";
import { checkAuthBlockTypeFromAuthModeBlockExists } from "./folderSettingsFiles/checkAuthBlockTypeFromAuthModeBlockExists";

export class BrunoLangDiagnosticsProvider {
    constructor(
        private diagnosticCollection: DiagnosticCollection,
        private itemProvider: CollectionItemProvider
    ) {
        this.relatedRequestsHelper = new RelatedFilesDiagnosticsHelper();
    }

    private relatedRequestsHelper: RelatedFilesDiagnosticsHelper;

    public dispose() {
        this.diagnosticCollection.clear();
        this.relatedRequestsHelper.dispose();
    }

    public provideDiagnosticsForRequestFile(
        documentUri: Uri,
        documentText: string
    ) {
        const newDiagnostics = this.determineDiagnosticsForRequestFile(
            documentUri,
            documentText
        );
        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }

    public provideDiagnosticsForEnvironmentFile(
        documentUri: Uri,
        documentText: string
    ) {
        const newDiagnostics = this.determineDiagnosticsForEnvironmentFile(
            documentUri,
            documentText
        );
        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }

    public provideDiagnosticsForFolderSettingsFile(
        documentUri: Uri,
        documentText: string
    ) {
        const newDiagnostics = this.determineDiagnosticsForFolderSettingsFile(
            documentUri,
            documentText
        );
        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }

    private determineDiagnosticsForRequestFile(
        documentUri: Uri,
        documentText: string
    ): DiagnosticWithCode[] {
        const document = new TextDocumentHelper(documentText);
        const { blocks, textOutsideOfBlocks } = parseBruFile(document);
        const blocksThatShouldBeDictionaryBlocks = blocks.filter(({ name }) =>
            shouldBeDictionaryBlock(name)
        );

        const results: DiagnosticWithCode[] = [];

        this.addToResults(
            results,
            ...checkOccurencesOfMandatoryBlocksForRequestFile(document, blocks),
            checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
            checkThatNoTextExistsOutsideOfBlocks(
                documentUri,
                textOutsideOfBlocks
            ),
            checkAtMostOneAuthBlockExists(documentUri, blocks),
            checkAtMostOneBodyBlockExists(documentUri, blocks),
            checkAuthBlockTypeFromMethodBlockExists(documentUri, blocks),
            checkBodyBlockTypeFromMethodBlockExists(documentUri, blocks),
            checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests(
                documentUri,
                blocks
            ),
            checkNoBlocksHaveUnknownNames(
                documentUri,
                blocks,
                Object.values(RequestFileBlockName) as string[]
            ),
            checkDictionaryBlocksHaveDictionaryStructure(
                documentUri,
                blocksThatShouldBeDictionaryBlocks
            ),
            checkDictionaryBlocksAreNotEmpty(
                documentUri,
                blocksThatShouldBeDictionaryBlocks
            ),
            checkUrlFromMethodBlockMatchesQueryParamsBlock(documentUri, blocks),
            checkUrlFromMethodBlockMatchesPathParamsBlock(documentUri, blocks),
            checkEitherAssertOrTestsBlockExists(document, blocks),
            checkBlocksAreSeparatedBySingleEmptyLine(
                documentUri,
                textOutsideOfBlocks
            )
        );

        const metaBlocks = blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlocks.length == 1) {
            this.addToResults(
                results,
                ...getMetaBlockSpecificDiagnosticsForRequestFile(
                    this.itemProvider,
                    this.relatedRequestsHelper,
                    documentUri,
                    document,
                    metaBlocks[0]
                )
            );
        }

        const methodBlocks = getAllMethodBlocks(blocks);

        if (methodBlocks.length == 1) {
            this.addToResults(
                results,
                ...getMethodBlockSpecificDiagnostics(methodBlocks[0])
            );
        }

        const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

        if (authBlocks.length == 1) {
            this.addToResults(
                results,
                ...getAuthBlockSpecificDiagnostics(authBlocks[0])
            );
        }

        const bodyBlocks = blocks.filter(({ name }) => isBodyBlock(name));

        if (bodyBlocks.length == 1) {
            this.addToResults(
                results,
                ...getRequestBodyBlockSpecificDiagnostics(bodyBlocks[0])
            );
        }

        return results;
    }

    private determineDiagnosticsForEnvironmentFile(
        documentUri: Uri,
        documentText: string
    ): DiagnosticWithCode[] {
        const document = new TextDocumentHelper(documentText);

        const { blocks, textOutsideOfBlocks } = parseBruFile(document);
        const blocksThatShouldBeDictionaryBlocks = blocks.filter(
            ({ name }) => name == EnvironmentFileBlockName.Vars
        );

        const results: DiagnosticWithCode[] = [];

        this.addToResults(
            results,
            checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
            checkThatNoTextExistsOutsideOfBlocks(
                documentUri,
                textOutsideOfBlocks
            ),
            checkNoBlocksHaveUnknownNames(
                documentUri,
                blocks,
                Object.values(EnvironmentFileBlockName)
            ),
            checkArrayBlocksHaveArrayStructure(
                documentUri,
                blocks.filter(
                    ({ name }) => name == EnvironmentFileBlockName.SecretVars
                )
            ),
            checkDictionaryBlocksHaveDictionaryStructure(
                documentUri,
                blocksThatShouldBeDictionaryBlocks
            ),
            checkDictionaryBlocksAreNotEmpty(
                documentUri,
                blocksThatShouldBeDictionaryBlocks
            )
        );

        return results;
    }

    private determineDiagnosticsForFolderSettingsFile(
        documentUri: Uri,
        documentText: string
    ): DiagnosticWithCode[] {
        const document = new TextDocumentHelper(documentText);

        const { blocks, textOutsideOfBlocks } = parseBruFile(document);
        const blocksThatShouldBeDictionaryBlocks = blocks.filter(
            ({ name }) =>
                shouldBeDictionaryBlock(name) ||
                name == FolderSettingsSpecificBlock.AuthMode
        );

        const results: DiagnosticWithCode[] = [];

        this.addToResults(
            results,
            checkOccurencesOfMandatoryBlocksForFolderSettingsFile(
                document,
                blocks
            ),
            checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
            checkThatNoTextExistsOutsideOfBlocks(
                documentUri,
                textOutsideOfBlocks
            ),
            checkAuthBlockTypeFromAuthModeBlockExists(documentUri, blocks),
            checkAtMostOneAuthBlockExists(documentUri, blocks),
            checkNoBlocksHaveUnknownNames(
                documentUri,
                blocks,
                Object.values(getValidBlockNamesForFolderSettingsFiles())
            ),
            checkDictionaryBlocksHaveDictionaryStructure(
                documentUri,
                blocksThatShouldBeDictionaryBlocks
            ),
            checkDictionaryBlocksAreNotEmpty(
                documentUri,
                blocksThatShouldBeDictionaryBlocks
            ),
            checkBlocksAreSeparatedBySingleEmptyLine(
                documentUri,
                textOutsideOfBlocks
            )
        );

        const metaBlocks = blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlocks.length == 1) {
            this.addToResults(
                results,
                ...getMetaBlockSpecificDiagnosticsForFolderSettings(
                    document,
                    metaBlocks[0]
                )
            );
        }

        const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

        if (authBlocks.length == 1) {
            this.addToResults(
                results,
                ...getAuthBlockSpecificDiagnostics(authBlocks[0])
            );
        }

        const authModeBlocks = blocks.filter(
            ({ name }) => name == FolderSettingsSpecificBlock.AuthMode
        );

        if (authModeBlocks.length == 1) {
            this.addToResults(
                results,
                ...getAuthModeBlockSpecificDiagnostics(authModeBlocks[0])
            );
        }

        return results;
    }

    private addToResults(
        results: DiagnosticWithCode[],
        ...maybeDiagnostics: (DiagnosticWithCode | undefined)[]
    ) {
        results.push(...maybeDiagnostics.filter((val) => val != undefined));
    }
}
