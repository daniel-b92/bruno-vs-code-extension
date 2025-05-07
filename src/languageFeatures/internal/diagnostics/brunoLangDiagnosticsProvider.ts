import { DiagnosticCollection, Uri } from "vscode";
import {
    CollectionItemProvider,
    EnvironmentFileBlockName,
    getAllMethodBlocks,
    isAuthBlock,
    parseBruFile,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { checkOccurencesOfMandatoryBlocks } from "./requestFiles/checks/multipleBlocks/checkOccurencesOfMandatoryBlocks";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "./shared/checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "./shared/checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneAuthBlockExists } from "./shared/checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAtMostOneBodyBlockExists } from "./requestFiles/checks/multipleBlocks/checkAtMostOneBodyBlockExists";
import { RelatedRequestsDiagnosticsHelper } from "./requestFiles/helpers/relatedRequestsDiagnosticsHelper";
import { checkBodyBlockTypeFromMethodBlockExists } from "./requestFiles/checks/multipleBlocks/checkBodyBlockTypeFromMethodBlockExists";
import { checkAuthBlockTypeFromMethodBlockExists } from "./requestFiles/checks/multipleBlocks/checkAuthBlockTypeFromMethodBlockExists";
import { checkNoBlocksHaveUnknownNames } from "./shared/checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkDictionaryBlocksHaveDictionaryStructure } from "./shared/checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { DiagnosticWithCode } from "./definitions";
import { checkEitherAssertOrTestsBlockExists } from "./requestFiles/checks/multipleBlocks/checkEitherAssertOrTestsBlockExists";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "./shared/checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { getMetaBlockSpecificDiagnostics } from "./getMetaBlockSpecificDiagnostics";
import { getMethodBlockSpecificDiagnostics } from "./getMethodBlockSpecificDiagnostics";
import { getAuthBlockSpecificDiagnostics } from "./getAuthBlockSpecificDiagnostics";
import { checkUrlFromMethodBlockMatchesQueryParamsBlock } from "./requestFiles/checks/multipleBlocks/checkUrlFromMethodBlockMatchesQueryParamsBlock";
import { checkUrlFromMethodBlockMatchesPathParamsBlock } from "./requestFiles/checks/multipleBlocks/checkUrlFromMethodBlockMatchesPathParamsBlock";
import { checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests } from "./requestFiles/checks/multipleBlocks/checkGraphQlSpecificBlocksAreNotDefinedForOtherRequests";
import { shouldBeDictionaryBlock } from "./requestFiles/util/shouldBeDictionaryBlock";
import { checkArrayBlocksHaveArrayStructure } from "./shared/checks/multipleBlocks/checkArrayBlocksHaveArrayStructure";

export class BrunoLangDiagnosticsProvider {
    constructor(
        private diagnosticCollection: DiagnosticCollection,
        private itemProvider: CollectionItemProvider
    ) {
        this.relatedRequestsHelper = new RelatedRequestsDiagnosticsHelper();
    }

    private relatedRequestsHelper: RelatedRequestsDiagnosticsHelper;

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

    private determineDiagnosticsForRequestFile(
        documentUri: Uri,
        documentText: string
    ): DiagnosticWithCode[] {
        const document = new TextDocumentHelper(documentText);
        const { blocks, textOutsideOfBlocks } = parseBruFile(document);

        const results: DiagnosticWithCode[] = [];

        this.addToResults(
            results,
            ...checkOccurencesOfMandatoryBlocks(document, blocks),
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
                blocks.filter(({ name }) => shouldBeDictionaryBlock(name))
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
                ...getMetaBlockSpecificDiagnostics(
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

        return results;
    }

    private determineDiagnosticsForEnvironmentFile(
        documentUri: Uri,
        documentText: string
    ): DiagnosticWithCode[] {
        const document = new TextDocumentHelper(documentText);

        const { blocks, textOutsideOfBlocks } = parseBruFile(document);

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
            )
        );

        return results;
    }

    private addToResults(
        results: DiagnosticWithCode[],
        ...maybeDiagnostics: (DiagnosticWithCode | undefined)[]
    ) {
        results.push(...maybeDiagnostics.filter((val) => val != undefined));
    }
}
