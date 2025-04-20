import { DiagnosticCollection, Uri } from "vscode";
import { checkMetaBlockStartsInFirstLine } from "./checks/singleBlocks/metaBlock/checkMetaBlockStartsInFirstLine";
import {
    AuthBlockName,
    castBlockToDictionaryBlock,
    CollectionItemProvider,
    getAllMethodBlocks,
    getMandatoryKeysForAuthBlock,
    isAuthBlock,
    MetaBlockKey,
    MethodBlockKey,
    parseTestFile,
    RequestFileBlock,
    RequestFileBlockName,
    TextDocumentHelper,
} from "../../../shared";
import { checkOccurencesOfMandatoryBlocks } from "./checks/multipleBlocks/checkOccurencesOfMandatoryBlocks";
import { checkThatNoBlocksAreDefinedMultipleTimes } from "./checks/multipleBlocks/checkThatNoBlocksAreDefinedMultipleTimes";
import { checkThatNoTextExistsOutsideOfBlocks } from "./checks/multipleBlocks/checkThatNoTextExistsOutsideOfBlocks";
import { checkAtMostOneAuthBlockExists } from "./checks/multipleBlocks/checkAtMostOneAuthBlockExists";
import { checkAtMostOneBodyBlockExists } from "./checks/multipleBlocks/checkAtMostOneBodyBlockExists";
import { checkSequenceInMetaBlockIsUniqueWithinFolder } from "./checks/relatedRequests/checkSequenceInMetaBlockIsUniqueWithinFolder";
import { RelatedRequestsDiagnosticsHelper } from "./helpers/relatedRequestsDiagnosticsHelper";
import { addDiagnosticForDocument } from "./util/addDiagnosticForDocument";
import { removeDiagnosticsForDocument } from "./util/removeDiagnosticsForDocument";
import { checkBodyBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkBodyBlockTypeFromMethodBlockExists";
import { checkAuthBlockTypeFromMethodBlockExists } from "./checks/multipleBlocks/checkAuthBlockTypeFromMethodBlockExists";
import { checkNoBlocksHaveUnknownNames } from "./checks/multipleBlocks/checkNoBlocksHaveUnknownNames";
import { checkDictionaryBlocksHaveDictionaryStructure } from "./checks/multipleBlocks/checkDictionaryBlocksHaveDictionaryStructure";
import { checkSequenceInMetaBlockIsNumeric } from "./checks/singleBlocks/metaBlock/checkSequenceInMetaBlockIsNumeric";
import { checkNoKeysAreMissingForDictionaryBlock } from "./checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "./checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "./checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "./definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "./diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelevantWithinMethodBlockDiagnosticCode } from "./diagnosticCodes/relevantWithinMethodBlockDiagnosticCodeEnum";
import { RelevantWithinAuthBlockDiagnosticCode } from "./diagnosticCodes/relevantWithinAuthBlockDiagnosticCodeEnum";
import { KnownDiagnosticCode } from "./diagnosticCodes/knownDiagnosticCodeEnum";

export class BrunoLangDiagnosticsProvider {
    constructor(
        private diagnosticCollection: DiagnosticCollection,
        private itemProvider: CollectionItemProvider
    ) {
        this.relatedRequestsHelper = new RelatedRequestsDiagnosticsHelper();
    }

    private relatedRequestsHelper: RelatedRequestsDiagnosticsHelper;

    public dispose() {}

    public provideDiagnostics(documentUri: Uri, documentText: string) {
        const document = new TextDocumentHelper(documentText);
        const { blocks, textOutsideOfBlocks } = parseTestFile(document);

        const { toAdd, toRemove } = checkOccurencesOfMandatoryBlocks(
            document,
            blocks
        );

        this.handleResults(documentUri, [
            ...toAdd,
            ...toRemove,
            checkThatNoBlocksAreDefinedMultipleTimes(documentUri, blocks),
            checkThatNoTextExistsOutsideOfBlocks(
                documentUri,
                textOutsideOfBlocks
            ),
            checkAtMostOneAuthBlockExists(documentUri, blocks),
            checkAtMostOneBodyBlockExists(documentUri, blocks),
            checkAuthBlockTypeFromMethodBlockExists(documentUri, blocks),
            checkBodyBlockTypeFromMethodBlockExists(documentUri, blocks),
            checkNoBlocksHaveUnknownNames(documentUri, blocks),
            checkDictionaryBlocksHaveDictionaryStructure(documentUri, blocks),
        ]);

        const metaBlocks = blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlocks.length == 1) {
            this.provideMetaBlockSpecificDiagnostics(
                documentUri,
                document,
                metaBlocks[0]
            );
        } else {
            removeDiagnosticsForDocument(
                documentUri,
                this.diagnosticCollection,
                ...Object.values(RelevantWithinMetaBlockDiagnosticCode)
            );
        }

        const methodBlocks = getAllMethodBlocks(blocks);

        if (methodBlocks.length == 1) {
            this.provideMethodBlockSpecificDiagnostics(
                documentUri,
                methodBlocks[0]
            );
        } else {
            removeDiagnosticsForDocument(
                documentUri,
                this.diagnosticCollection,
                ...Object.values(RelevantWithinMethodBlockDiagnosticCode)
            );
        }

        const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

        if (authBlocks.length == 1) {
            this.provideAuthBlockSpecificDiagnostics(
                documentUri,
                authBlocks[0]
            );
        } else {
            removeDiagnosticsForDocument(
                documentUri,
                this.diagnosticCollection,
                ...Object.values(RelevantWithinAuthBlockDiagnosticCode)
            );
        }
    }

    private provideMetaBlockSpecificDiagnostics(
        documentUri: Uri,
        documentHelper: TextDocumentHelper,
        metaBlock: RequestFileBlock
    ) {
        const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);
        const metaBlockKeys = Object.values(MetaBlockKey);

        this.handleResults(documentUri, [
            checkSequenceInMetaBlockIsNumeric(metaBlock),
            castedMetaBlock
                ? checkNoKeysAreMissingForDictionaryBlock(
                      castedMetaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock
                  )
                : RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock,
            castedMetaBlock
                ? checkNoUnknownKeysAreDefinedInDictionaryBlock(
                      castedMetaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock
                  )
                : RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock,
            castedMetaBlock
                ? checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                      castedMetaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock
                  )
                : RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock,
            checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
        ]);

        for (const results of this.provideRelatedRequestsDiagnosticsForMetaBlock(
            this.itemProvider,
            metaBlock,
            documentUri,
            this.relatedRequestsHelper
        )) {
            this.handleResults(results.uri, [results.result]);
        }
    }

    private provideMethodBlockSpecificDiagnostics(
        documentUri: Uri,
        methodBlock: RequestFileBlock
    ) {
        const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);
        const methodBlockKeys = Object.values(MethodBlockKey);

        this.handleResults(documentUri, [
            castedMethodBlock
                ? checkNoKeysAreMissingForDictionaryBlock(
                      castedMethodBlock,
                      methodBlockKeys,
                      RelevantWithinMethodBlockDiagnosticCode.KeysMissingInMethodBlock
                  )
                : RelevantWithinMethodBlockDiagnosticCode.KeysMissingInMethodBlock,
            castedMethodBlock
                ? checkNoUnknownKeysAreDefinedInDictionaryBlock(
                      castedMethodBlock,
                      methodBlockKeys,
                      RelevantWithinMethodBlockDiagnosticCode.UnknownKeysDefinedInMethodBlock
                  )
                : RelevantWithinMethodBlockDiagnosticCode.UnknownKeysDefinedInMethodBlock,
            castedMethodBlock
                ? checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                      castedMethodBlock,
                      methodBlockKeys,
                      RelevantWithinMethodBlockDiagnosticCode.DuplicateKeysDefinedInMethodBlock
                  )
                : RelevantWithinMethodBlockDiagnosticCode.DuplicateKeysDefinedInMethodBlock,
        ]);
    }

    private provideAuthBlockSpecificDiagnostics(
        documentUri: Uri,
        authBlock: RequestFileBlock
    ) {
        const castedAuthBlock = castBlockToDictionaryBlock(authBlock);

        const typesWhereDiagnosticsCanBeDetermined = [
            RequestFileBlockName.BasicAuth,
            RequestFileBlockName.BearerAuth,
            RequestFileBlockName.DigestAuth,
            RequestFileBlockName.ApiKeyAuth,
            RequestFileBlockName.AwsSigV4Auth,
            RequestFileBlockName.NtlmAuth,
            RequestFileBlockName.OAuth2Auth,
            RequestFileBlockName.WsseAuth,
        ];

        if (
            !castedAuthBlock ||
            !(typesWhereDiagnosticsCanBeDetermined as string[]).includes(
                castedAuthBlock.name
            )
        ) {
            return;
        }

        const mandatoryKeys = (
            Object.values(AuthBlockName) as string[]
        ).includes(castedAuthBlock.name)
            ? getMandatoryKeysForAuthBlock(
                  castedAuthBlock.name as AuthBlockName
              )
            : undefined;

        if (mandatoryKeys != undefined) {
            this.handleResults(documentUri, [
                checkNoKeysAreMissingForDictionaryBlock(
                    castedAuthBlock,
                    mandatoryKeys,
                    RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock
                ),
                // ToDo: Determine valid keys for OAuth2 section depending on grant type.
                // Then this validation could be enabled.
                castedAuthBlock.name != RequestFileBlockName.OAuth2Auth
                    ? checkNoUnknownKeysAreDefinedInDictionaryBlock(
                          castedAuthBlock,
                          mandatoryKeys,
                          RelevantWithinAuthBlockDiagnosticCode.UnknownKeysDefinedInAuthBlock
                      )
                    : RelevantWithinAuthBlockDiagnosticCode.UnknownKeysDefinedInAuthBlock,
                checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                    castedAuthBlock,
                    mandatoryKeys,
                    RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock
                ),
            ]);
        }
    }

    private handleResults(
        documentUri: Uri,
        results: (DiagnosticWithCode | KnownDiagnosticCode | undefined)[]
    ) {
        for (const result of results) {
            if (result && typeof result != "string") {
                addDiagnosticForDocument(
                    documentUri,
                    this.diagnosticCollection,
                    result
                );
            } else if (result != undefined) {
                removeDiagnosticsForDocument(
                    documentUri,
                    this.diagnosticCollection,
                    result
                );
            }
        }
    }

    private provideRelatedRequestsDiagnosticsForMetaBlock(
        itemProvider: CollectionItemProvider,
        metaBlock: RequestFileBlock,
        documentUri: Uri,
        relatedRequestsHelper: RelatedRequestsDiagnosticsHelper
    ): {
        uri: Uri;
        result: DiagnosticWithCode | KnownDiagnosticCode;
    }[] {
        const { code, toAdd } = checkSequenceInMetaBlockIsUniqueWithinFolder(
            itemProvider,
            metaBlock,
            documentUri
        );

        if (toAdd) {
            relatedRequestsHelper.registerDiagnostic({
                files: toAdd.affectedFiles,
                diagnosticCode: code,
            });

            return [{ uri: documentUri, result: toAdd.diagnosticCurrentFile }];
        } else {
            return relatedRequestsHelper
                .unregisterDiagnostic(documentUri.fsPath, code)
                .map(({ file, code }) => ({
                    uri: Uri.file(file),
                    result: code,
                }));
        }
    }
}
