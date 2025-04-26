import { DiagnosticCollection, Uri } from "vscode";
import { checkMetaBlockStartsInFirstLine } from "./checks/singleBlocks/metaBlock/checkMetaBlockStartsInFirstLine";
import {
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    AuthBlockName,
    BooleanFieldValue,
    castBlockToDictionaryBlock,
    CollectionItemProvider,
    DictionaryBlock,
    DictionaryBlockField,
    getAllMethodBlocks,
    getMandatoryKeysForNonOAuth2Block,
    getMandatoryKeysForOAuth2Block,
    isAuthBlock,
    MetaBlockKey,
    MethodBlockKey,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2GrantType,
    OAuth2ViaAuthorizationCodeBlockKey,
    parseTestFile,
    RequestFileBlock,
    RequestFileBlockName,
    RequestType,
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
import { checkSequenceInMetaBlockIsValid } from "./checks/singleBlocks/metaBlock/checkSequenceInMetaBlockIsValid";
import { checkNoKeysAreMissingForDictionaryBlock } from "./checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "./checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "./checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { DiagnosticWithCode } from "./definitions";
import { RelevantWithinMetaBlockDiagnosticCode } from "./diagnosticCodes/relevantWithinMetaBlockDiagnosticCodeEnum";
import { RelevantWithinMethodBlockDiagnosticCode } from "./diagnosticCodes/relevantWithinMethodBlockDiagnosticCodeEnum";
import { RelevantWithinAuthBlockDiagnosticCode } from "./diagnosticCodes/relevantWithinAuthBlockDiagnosticCodeEnum";
import { checkValueForDictionaryBlockFieldIsValid } from "./checks/singleBlocks/checkValueForDictionaryBlockFieldIsValid";
import { checkEitherAssertOrTestsBlockExists } from "./checks/multipleBlocks/checkEitherAssertOrTestsBlockExists";
import { checkBlocksAreSeparatedBySingleEmptyLine } from "./checks/multipleBlocks/checkBlocksAreSeparatedBySingleEmptyLine";
import { checkNoMandatoryValuesAreMissingForDictionaryBlock } from "./checks/singleBlocks/checkNoMandatoryValuesAreMissingForDictionaryBlock";

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
            checkDictionaryBlocksHaveDictionaryStructure(documentUri, blocks),
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
            checkSequenceInMetaBlockIsValid(metaBlock),
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
                ? checkNoMandatoryValuesAreMissingForDictionaryBlock(
                      castedMetaBlock,
                      [MetaBlockKey.Name],
                      RelevantWithinMetaBlockDiagnosticCode.MandatoryValuesMissingInMetaBlock
                  )
                : undefined,
            castedMetaBlock
                ? checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                      castedMetaBlock,
                      metaBlockKeys,
                      RelevantWithinMetaBlockDiagnosticCode.DuplicateKeysDefinedInMetaBlock
                  )
                : undefined,
            castedMetaBlock &&
            castedMetaBlock.content.filter(
                ({ key }) => key == MetaBlockKey.Type
            ).length == 1
                ? checkValueForDictionaryBlockFieldIsValid(
                      castedMetaBlock.content.find(
                          ({ key }) => key == MetaBlockKey.Type
                      ) as DictionaryBlockField,
                      Object.values(RequestType),
                      RelevantWithinMetaBlockDiagnosticCode.RequestTypeNotValid
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

            if (
                castedAuthBlock.name == AuthBlockName.ApiKeyAuth &&
                castedAuthBlock.content.some(
                    ({ key }) => key == ApiKeyAuthBlockKey.Placement
                )
            ) {
                diagnostics.push(
                    checkValueForDictionaryBlockFieldIsValid(
                        castedAuthBlock.content.find(
                            ({ key }) => key == ApiKeyAuthBlockKey.Placement
                        ) as DictionaryBlockField,
                        Object.values(ApiKeyAuthBlockPlacementValue),
                        RelevantWithinAuthBlockDiagnosticCode.InvalidApiKeyAuthValueForPlacement
                    )
                );
            }
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

        diagnostics.push(
            ...diagnosticsForGrantTypeField,
            ...this.checkValuesForOAuth2FieldsCommonForAllGrantTypes(authBlock)
        );

        if (
            diagnosticsForGrantTypeField.filter((val) => val != undefined)
                .length > 0
        ) {
            // For further validations, the grant type needs to be set to a valid value
            // (since it depends on the grant type, e.g. which keys are mandatory).
            return diagnostics;
        }

        const grantType = grantTypeFields[0].value as OAuth2GrantType;

        diagnostics.push(
            ...this.checkValuesForOAuth2FieldsDependingOnGrantType(
                authBlock,
                grantType
            )
        );

        return diagnostics;
    }

    private checkValuesForOAuth2FieldsCommonForAllGrantTypes(
        authBlock: DictionaryBlock
    ) {
        const diagnostics: (DiagnosticWithCode | undefined)[] = [];

        const credentialsPlacementFields = authBlock.content.filter(
            ({ key }) =>
                key == OAuth2ViaAuthorizationCodeBlockKey.CredentialsPlacement
        );

        diagnostics.push(
            credentialsPlacementFields.length == 1
                ? checkValueForDictionaryBlockFieldIsValid(
                      credentialsPlacementFields[0],
                      Object.values(OAuth2BlockCredentialsPlacementValue),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForCredentialsPlacement
                  )
                : undefined
        );

        const tokenPlacementFields = authBlock.content.filter(
            ({ key }) =>
                key == OAuth2ViaAuthorizationCodeBlockKey.TokenPlacement
        );

        diagnostics.push(
            tokenPlacementFields.length == 1
                ? checkValueForDictionaryBlockFieldIsValid(
                      tokenPlacementFields[0],
                      Object.values(OAuth2BlockTokenPlacementValue),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForTokenPlacement
                  )
                : undefined
        );

        const autoFetchTokenFields = authBlock.content.filter(
            ({ key }) =>
                key == OAuth2ViaAuthorizationCodeBlockKey.AutoFetchToken
        );

        diagnostics.push(
            autoFetchTokenFields.length == 1
                ? checkValueForDictionaryBlockFieldIsValid(
                      autoFetchTokenFields[0],
                      Object.values(BooleanFieldValue),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForAutoFetchToken
                  )
                : undefined
        );

        const autoRefreshTokenFields = authBlock.content.filter(
            ({ key }) =>
                key == OAuth2ViaAuthorizationCodeBlockKey.AutoRefreshToken
        );

        diagnostics.push(
            autoRefreshTokenFields.length == 1
                ? checkValueForDictionaryBlockFieldIsValid(
                      autoRefreshTokenFields[0],
                      Object.values(BooleanFieldValue),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForAutoRefreshToken
                  )
                : undefined
        );

        return diagnostics;
    }

    private checkValuesForOAuth2FieldsDependingOnGrantType(
        authBlock: DictionaryBlock,
        grantType: OAuth2GrantType
    ) {
        const diagnostics: (DiagnosticWithCode | undefined)[] = [];

        const mandatoryKeys = getMandatoryKeysForOAuth2Block(grantType);

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

        if (grantType == OAuth2GrantType.AuthorizationCode) {
            const pkceFields = authBlock.content.filter(
                ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKey.Pkce
            );

            diagnostics.push(
                pkceFields.length == 1
                    ? checkValueForDictionaryBlockFieldIsValid(
                          pkceFields[0],
                          Object.values(BooleanFieldValue),
                          RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForPkce
                      )
                    : undefined
            );
        }

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
