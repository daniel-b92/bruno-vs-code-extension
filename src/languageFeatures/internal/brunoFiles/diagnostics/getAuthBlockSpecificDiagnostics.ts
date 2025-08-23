import {
    Block,
    castBlockToDictionaryBlock,
    AuthBlockName,
    getMandatoryKeysForNonOAuth2Block,
    ApiKeyAuthBlockKey,
    DictionaryBlockField,
    ApiKeyAuthBlockPlacementValue,
    BooleanFieldValue,
    DictionaryBlock,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2GrantType,
    OAuth2ViaAuthorizationCodeBlockKey,
    getMandatoryKeysForOAuth2Block,
} from "../../../../shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "./shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockFieldIsValid } from "./shared/checks/singleBlocks/checkValueForDictionaryBlockFieldIsValid";
import { DiagnosticWithCode } from "./definitions";
import { RelevantWithinAuthBlockDiagnosticCode } from "./shared/diagnosticCodes/relevantWithinAuthBlockDiagnosticCodeEnum";

export function getAuthBlockSpecificDiagnostics(
    authBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    const castedAuthBlock = castBlockToDictionaryBlock(authBlock);

    if (!castedAuthBlock) {
        return [];
    }

    const mandatoryKeys: string[] = [];
    const diagnostics: (DiagnosticWithCode | undefined)[] = [];

    if (
        (Object.values(AuthBlockName) as string[]).includes(
            castedAuthBlock.name,
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
                    | AuthBlockName.WsseAuth,
            ),
        );
        diagnostics.push(
            checkNoKeysAreMissingForDictionaryBlock(
                castedAuthBlock,
                mandatoryKeys,
                RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock,
            ),
            checkNoUnknownKeysAreDefinedInDictionaryBlock(
                castedAuthBlock,
                mandatoryKeys,
                RelevantWithinAuthBlockDiagnosticCode.UnknownKeysDefinedInAuthBlock,
            ),
            checkNoDuplicateKeysAreDefinedForDictionaryBlock(
                castedAuthBlock,
                mandatoryKeys,
                RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
            ),
        );

        if (
            castedAuthBlock.name == AuthBlockName.ApiKeyAuth &&
            castedAuthBlock.content.some(
                ({ key }) => key == ApiKeyAuthBlockKey.Placement,
            )
        ) {
            diagnostics.push(
                checkValueForDictionaryBlockFieldIsValid(
                    castedAuthBlock.content.find(
                        ({ key }) => key == ApiKeyAuthBlockKey.Placement,
                    ) as DictionaryBlockField,
                    Object.values(ApiKeyAuthBlockPlacementValue),
                    RelevantWithinAuthBlockDiagnosticCode.InvalidApiKeyAuthValueForPlacement,
                ),
            );
        }
    } else if (castedAuthBlock.name == AuthBlockName.OAuth2Auth) {
        diagnostics.push(...getDiagnosticsForOAuth2AuthBlock(castedAuthBlock));
    }

    return diagnostics;
}

function getDiagnosticsForOAuth2AuthBlock(
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
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            authBlock,
            [OAuth2ViaAuthorizationCodeBlockKey.GrantType],
            RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
        ),
        grantTypeFields.length == 1
            ? checkValueForDictionaryBlockFieldIsValid(
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
        0
    ) {
        // For further validations, the grant type needs to be set to a valid value
        // (since it depends on the grant type, e.g. which keys are mandatory).
        return diagnostics;
    }

    const grantType = grantTypeFields[0].value as OAuth2GrantType;

    diagnostics.push(
        ...checkValuesForOAuth2FieldsDependingOnGrantType(authBlock, grantType),
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
        credentialsPlacementFields.length == 1
            ? checkValueForDictionaryBlockFieldIsValid(
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
        tokenPlacementFields.length == 1
            ? checkValueForDictionaryBlockFieldIsValid(
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
        autoFetchTokenFields.length == 1
            ? checkValueForDictionaryBlockFieldIsValid(
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
        autoRefreshTokenFields.length == 1
            ? checkValueForDictionaryBlockFieldIsValid(
                  autoRefreshTokenFields[0],
                  Object.values(BooleanFieldValue),
                  RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForAutoRefreshToken,
              )
            : undefined,
    );

    return diagnostics;
}

function checkValuesForOAuth2FieldsDependingOnGrantType(
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
        checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            authBlock,
            mandatoryKeys,
            RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
        ),
    );

    if (grantType == OAuth2GrantType.AuthorizationCode) {
        const pkceFields = authBlock.content.filter(
            ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKey.Pkce,
        );

        diagnostics.push(
            pkceFields.length == 1
                ? checkValueForDictionaryBlockFieldIsValid(
                      pkceFields[0],
                      Object.values(BooleanFieldValue),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForPkce,
                  )
                : undefined,
        );
    }

    return diagnostics;
}
