import {
    Block,
    isBlockDictionaryBlock,
    AuthBlockName,
    getMandatoryKeysForNonOAuth2Block,
    ApiKeyAuthBlockKey,
    ApiKeyAuthBlockPlacementValue,
    BooleanFieldValue,
    DictionaryBlock,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2GrantType,
    OAuth2ViaAuthorizationCodeBlockKey,
    getMandatoryKeysForOAuth2Block,
    isDictionaryBlockSimpleField,
} from "../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "./shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "./shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { DiagnosticWithCode } from "./definitions";
import { RelevantWithinAuthBlockDiagnosticCode } from "./shared/diagnosticCodes/relevantWithinAuthBlockDiagnosticCodeEnum";
import { Uri } from "vscode";

export function getAuthBlockSpecificDiagnostics(
    documentUri: Uri,
    authBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(authBlock)) {
        return [];
    }

    const mandatoryKeys: string[] = [];
    const diagnostics: (DiagnosticWithCode | undefined)[] = [];

    if (
        (Object.values(AuthBlockName) as string[]).includes(authBlock.name) &&
        authBlock.name != AuthBlockName.OAuth2Auth
    ) {
        mandatoryKeys.push(
            ...getMandatoryKeysForNonOAuth2Block(
                authBlock.name as
                    | AuthBlockName.ApiKeyAuth
                    | AuthBlockName.AwsSigV4Auth
                    | AuthBlockName.BasicAuth
                    | AuthBlockName.BearerAuth
                    | AuthBlockName.DigestAuth
                    | AuthBlockName.NtlmAuth
                    | AuthBlockName.WsseAuth,
            ),
        );
        diagnostics.push(
            checkNoKeysAreMissingForDictionaryBlock(
                authBlock,
                mandatoryKeys,
                RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock,
            ),
            checkNoUnknownKeysAreDefinedInDictionaryBlock(
                authBlock,
                mandatoryKeys,
                RelevantWithinAuthBlockDiagnosticCode.UnknownKeysDefinedInAuthBlock,
            ),
            ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                documentUri,
                authBlock,
                RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
                mandatoryKeys,
            ) ?? []),
        );

        if (
            authBlock.name == AuthBlockName.ApiKeyAuth &&
            authBlock.content.some(
                ({ key }) => key == ApiKeyAuthBlockKey.Placement,
            )
        ) {
            const field = authBlock.content.find(
                ({ key }) => key == ApiKeyAuthBlockKey.Placement,
            );

            if (field && isDictionaryBlockSimpleField(field)) {
                diagnostics.push(
                    checkValueForDictionaryBlockSimpleFieldIsValid(
                        field,
                        Object.values(ApiKeyAuthBlockPlacementValue),
                        RelevantWithinAuthBlockDiagnosticCode.InvalidApiKeyAuthValueForPlacement,
                    ),
                );
            }
        }
    } else if (authBlock.name == AuthBlockName.OAuth2Auth) {
        diagnostics.push(
            ...getDiagnosticsForOAuth2AuthBlock(documentUri, authBlock),
        );
    }

    return diagnostics;
}

function getDiagnosticsForOAuth2AuthBlock(
    documentUri: Uri,
    authBlock: DictionaryBlock,
): (DiagnosticWithCode | undefined)[] {
    const diagnostics: (DiagnosticWithCode | undefined)[] = [];

    const grantTypeFields = authBlock.content.filter(
        ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKey.GrantType,
    );

    const diagnosticsForGrantTypeField: (DiagnosticWithCode | undefined)[] = [];

    diagnosticsForGrantTypeField.push(
        checkNoKeysAreMissingForDictionaryBlock(
            authBlock,
            [OAuth2ViaAuthorizationCodeBlockKey.GrantType],
            RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock,
        ),
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            documentUri,
            authBlock,
            RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
            [OAuth2ViaAuthorizationCodeBlockKey.GrantType],
        ) ?? []),
        grantTypeFields.length == 1 &&
            isDictionaryBlockSimpleField(grantTypeFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  grantTypeFields[0],
                  Object.values(OAuth2GrantType),
                  RelevantWithinAuthBlockDiagnosticCode.InvalidGrantType,
              )
            : undefined,
    );

    diagnostics.push(
        ...diagnosticsForGrantTypeField,
        ...checkValuesForOAuth2FieldsCommonForAllGrantTypes(authBlock),
    );

    if (
        diagnosticsForGrantTypeField.filter((val) => val != undefined).length >
            0 ||
        !isDictionaryBlockSimpleField(grantTypeFields[0])
    ) {
        // For further validations, the grant type needs to be set to a valid value
        // (since it depends on the grant type, e.g. which keys are mandatory).
        return diagnostics;
    }

    const grantType = grantTypeFields[0].value as OAuth2GrantType;

    diagnostics.push(
        ...checkValuesForOAuth2FieldsDependingOnGrantType(
            documentUri,
            authBlock,
            grantType,
        ),
    );

    return diagnostics;
}

function checkValuesForOAuth2FieldsCommonForAllGrantTypes(
    authBlock: DictionaryBlock,
) {
    const diagnostics: (DiagnosticWithCode | undefined)[] = [];

    const credentialsPlacementFields = authBlock.content.filter(
        ({ key }) =>
            key == OAuth2ViaAuthorizationCodeBlockKey.CredentialsPlacement,
    );

    diagnostics.push(
        credentialsPlacementFields.length == 1 &&
            isDictionaryBlockSimpleField(credentialsPlacementFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  credentialsPlacementFields[0],
                  Object.values(OAuth2BlockCredentialsPlacementValue),
                  RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForCredentialsPlacement,
              )
            : undefined,
    );

    const tokenPlacementFields = authBlock.content.filter(
        ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKey.TokenPlacement,
    );

    diagnostics.push(
        tokenPlacementFields.length == 1 &&
            isDictionaryBlockSimpleField(tokenPlacementFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  tokenPlacementFields[0],
                  Object.values(OAuth2BlockTokenPlacementValue),
                  RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForTokenPlacement,
              )
            : undefined,
    );

    const autoFetchTokenFields = authBlock.content.filter(
        ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKey.AutoFetchToken,
    );

    diagnostics.push(
        autoFetchTokenFields.length == 1 &&
            isDictionaryBlockSimpleField(autoFetchTokenFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  autoFetchTokenFields[0],
                  Object.values(BooleanFieldValue),
                  RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForAutoFetchToken,
              )
            : undefined,
    );

    const autoRefreshTokenFields = authBlock.content.filter(
        ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKey.AutoRefreshToken,
    );

    diagnostics.push(
        autoRefreshTokenFields.length == 1 &&
            isDictionaryBlockSimpleField(autoRefreshTokenFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  autoRefreshTokenFields[0],
                  Object.values(BooleanFieldValue),
                  RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForAutoRefreshToken,
              )
            : undefined,
    );

    return diagnostics;
}

function checkValuesForOAuth2FieldsDependingOnGrantType(
    documentUri: Uri,
    authBlock: DictionaryBlock,
    grantType: OAuth2GrantType,
) {
    const diagnostics: (DiagnosticWithCode | undefined)[] = [];

    const mandatoryKeys = getMandatoryKeysForOAuth2Block(grantType);

    diagnostics.push(
        checkNoKeysAreMissingForDictionaryBlock(
            authBlock,
            mandatoryKeys,
            RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock,
        ),
        checkNoUnknownKeysAreDefinedInDictionaryBlock(
            authBlock,
            mandatoryKeys,
            RelevantWithinAuthBlockDiagnosticCode.UnknownKeysDefinedInAuthBlock,
        ),
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            documentUri,
            authBlock,
            RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
            mandatoryKeys,
        ) ?? []),
    );

    if (grantType == OAuth2GrantType.AuthorizationCode) {
        const pkceFields = authBlock.content.filter(
            ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKey.Pkce,
        );

        diagnostics.push(
            pkceFields.length == 1 &&
                isDictionaryBlockSimpleField(pkceFields[0])
                ? checkValueForDictionaryBlockSimpleFieldIsValid(
                      pkceFields[0],
                      Object.values(BooleanFieldValue),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForPkce,
                  )
                : undefined,
        );
    }

    return diagnostics;
}
