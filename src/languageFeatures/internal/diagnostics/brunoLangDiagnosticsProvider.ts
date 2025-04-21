import { DiagnosticCollection, Uri } from "vscode";
import { checkMetaBlockStartsInFirstLine } from "./checks/singleBlocks/metaBlock/checkMetaBlockStartsInFirstLine";
import {
    AuthBlockName,
    castBlockToDictionaryBlock,
    CollectionItemProvider,
    DictionaryBlock,
    getAllMethodBlocks,
    getMandatoryKeysForNonOAuth2Block,
    getMandatoryKeysForOAuth2Block,
    isAuthBlock,
    MetaBlockKey,
    MethodBlockKey,
    OAuth2GrantType,
    OAuth2ViaAuthorizationCodeBlockKey,
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
import { checkValueForDictionaryBlockFieldIsValid } from "./checks/singleBlocks/checkValueForDictionaryBlockFieldIsValid";

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

    public provideDiagnostics(documentUri: Uri, documentText: string) {
        const newDiagnostics = this.determineDiagnostics(
            documentUri,
            documentText
        );
        this.diagnosticCollection.set(documentUri, newDiagnostics);
    }

    private determineDiagnostics(
        documentUri: Uri,
        documentText: string
    ): DiagnosticWithCode[] {
        const document = new TextDocumentHelper(documentText);
        const { blocks, textOutsideOfBlocks } = parseTestFile(document);

        const results: DiagnosticWithCode[] = [];

        const addToResults = (
            ...maybeDiagnostics: (DiagnosticWithCode | undefined)[]
        ) => {
            results.push(...maybeDiagnostics.filter((val) => val != undefined));
        };

        addToResults(
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
            checkNoBlocksHaveUnknownNames(documentUri, blocks),
            checkDictionaryBlocksHaveDictionaryStructure(documentUri, blocks)
        );

        const metaBlocks = blocks.filter(
            ({ name }) => name == RequestFileBlockName.Meta
        );

        if (metaBlocks.length == 1) {
            addToResults(
                ...this.getMetaBlockSpecificDiagnostics(
                    documentUri,
                    document,
                    metaBlocks[0]
                )
            );
        }

        const methodBlocks = getAllMethodBlocks(blocks);

        if (methodBlocks.length == 1) {
            addToResults(
                ...this.provideMethodBlockSpecificDiagnostics(methodBlocks[0])
            );
        }

        const authBlocks = blocks.filter(({ name }) => isAuthBlock(name));

        if (authBlocks.length == 1) {
            addToResults(
                ...this.provideAuthBlockSpecificDiagnostics(authBlocks[0])
            );
        }

        return results;
    }

    private getMetaBlockSpecificDiagnostics(
        documentUri: Uri,
        documentHelper: TextDocumentHelper,
        metaBlock: RequestFileBlock
    ): (DiagnosticWithCode | undefined)[] {
        const castedMetaBlock = castBlockToDictionaryBlock(metaBlock);
        const metaBlockKeys = Object.values(MetaBlockKey);

        const diagnostics = [
            checkSequenceInMetaBlockIsNumeric(metaBlock),
            castedMetaBlock
                ? checkNoKeysAreMissingForDictionaryBlock(
                      castedMetaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.KeysMissingInMetaBlock
                  )
                : undefined,
            castedMetaBlock
                ? checkNoUnknownKeysAreDefinedInDictionaryBlock(
                      castedMetaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.UnknownKeysDefinedInMetaBlock
                  )
                : undefined,
            castedMetaBlock
                ? checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                      castedMetaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock
                  )
                : undefined,
            checkMetaBlockStartsInFirstLine(documentHelper, metaBlock),
        ];

        for (const results of this.provideRelatedRequestsDiagnosticsForMetaBlock(
            this.itemProvider,
            metaBlock,
            documentUri,
            this.relatedRequestsHelper
        )) {
            diagnostics.push(results.result);
        }

        return diagnostics;
    }

    private provideMethodBlockSpecificDiagnostics(
        methodBlock: RequestFileBlock
    ): (DiagnosticWithCode | undefined)[] {
        const castedMethodBlock = castBlockToDictionaryBlock(methodBlock);
        const methodBlockKeys = Object.values(MethodBlockKey);

        return [
            castedMethodBlock
                ? checkNoKeysAreMissingForDictionaryBlock(
                      castedMethodBlock,
                      methodBlockKeys,
                      RelevantWithinMethodBlockDiagnosticCode.KeysMissingInMethodBlock
                  )
                : undefined,
            castedMethodBlock
                ? checkNoUnknownKeysAreDefinedInDictionaryBlock(
                      castedMethodBlock,
                      methodBlockKeys,
                      RelevantWithinMethodBlockDiagnosticCode.UnknownKeysDefinedInMethodBlock
                  )
                : undefined,
            castedMethodBlock
                ? checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                      castedMethodBlock,
                      methodBlockKeys,
                      RelevantWithinMethodBlockDiagnosticCode.DuplicateKeysDefinedInMethodBlock
                  )
                : undefined,
        ];
    }

    private provideAuthBlockSpecificDiagnostics(
        authBlock: RequestFileBlock
    ): (DiagnosticWithCode | undefined)[] {
        const castedAuthBlock = castBlockToDictionaryBlock(authBlock);

        if (!castedAuthBlock) {
            return [];
        }

        const mandatoryKeys: string[] = [];
        const diagnostics: (DiagnosticWithCode | undefined)[] = [];

        if (
            (Object.values(AuthBlockName) as string[]).includes(
                castedAuthBlock.name
            ) &&
            castedAuthBlock.name != AuthBlockName.OAuth2Auth
        ) {
            mandatoryKeys.push(
                ...getMandatoryKeysForNonOAuth2Block(
                    castedAuthBlock.name as
                        | AuthBlockName.ApiKeyAuth
                        | AuthBlockName.AwsSigV4Auth
                        | AuthBlockName.BasicAuth
                        | AuthBlockName.BearerAuth
                        | AuthBlockName.DigestAuth
                        | AuthBlockName.NtlmAuth
                        | AuthBlockName.WsseAuth
                )
            );
            diagnostics.push(
                checkNoKeysAreMissingForDictionaryBlock(
                    castedAuthBlock,
                    mandatoryKeys,
                    RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock
                ),
                checkNoUnknownKeysAreDefinedInDictionaryBlock(
                    castedAuthBlock,
                    mandatoryKeys,
                    RelevantWithinAuthBlockDiagnosticCode.UnknownKeysDefinedInAuthBlock
                ),
                checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                    castedAuthBlock,
                    mandatoryKeys,
                    RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock
                )
            );
        } else if (castedAuthBlock.name == AuthBlockName.OAuth2Auth) {
            diagnostics.push(
                ...this.getDiagnosticsForOAuth2AuthBlock(castedAuthBlock)
            );
        }

        return diagnostics;
    }

    private getDiagnosticsForOAuth2AuthBlock(
        authBlock: DictionaryBlock
    ): (DiagnosticWithCode | undefined)[] {
        const diagnostics: (DiagnosticWithCode | undefined)[] = [];

        const grantTypeFields = authBlock.content.filter(
            ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKey.GrantType
        );

        const diagnosticsForGrantTypeField: (DiagnosticWithCode | undefined)[] =
            [];

        diagnosticsForGrantTypeField.push(
            checkNoKeysAreMissingForDictionaryBlock(
                authBlock,
                [OAuth2ViaAuthorizationCodeBlockKey.GrantType],
                RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock
            ),
            checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                authBlock,
                [OAuth2ViaAuthorizationCodeBlockKey.GrantType],
                RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock
            ),
            grantTypeFields.length == 1
                ? checkValueForDictionaryBlockFieldIsValid(
                      grantTypeFields[0],
                      Object.values(OAuth2GrantType),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidGrantType
                  )
                : undefined
        );

        diagnostics.push(...diagnosticsForGrantTypeField);

        // For further validations, the grant type needs to be set a valid value (since it depends on the grant type, e.g. which keys are mandatory).
        if (
            diagnosticsForGrantTypeField.filter((val) => val != undefined)
                .length > 0
        ) {
            return diagnostics;
        }

        const mandatoryKeys = getMandatoryKeysForOAuth2Block(
            grantTypeFields[0].value as OAuth2GrantType
        );

        diagnostics.push(
            checkNoKeysAreMissingForDictionaryBlock(
                authBlock,
                mandatoryKeys,
                RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock
            ),
            checkNoUnknownKeysAreDefinedInDictionaryBlock(
                authBlock,
                mandatoryKeys,
                RelevantWithinAuthBlockDiagnosticCode.UnknownKeysDefinedInAuthBlock
            ),
            checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                authBlock,
                mandatoryKeys,
                RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock
            )
        );

        return diagnostics;
    }

    private provideRelatedRequestsDiagnosticsForMetaBlock(
        itemProvider: CollectionItemProvider,
        metaBlock: RequestFileBlock,
        documentUri: Uri,
        relatedRequestsHelper: RelatedRequestsDiagnosticsHelper
    ): {
        uri: Uri;
        result: DiagnosticWithCode;
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
            relatedRequestsHelper.unregisterDiagnostic(
                documentUri.fsPath,
                code
            );
            return [];
        }
    }
}
