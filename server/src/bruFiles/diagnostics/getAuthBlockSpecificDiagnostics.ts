import {
    Block,
    isBlockDictionaryBlock,
    AuthBlockName,
    getMandatoryKeysForNonOAuth2Block,
    ApiKeyAuthBlockKeys,
    ApiKeyAuthBlockPlacementValue,
    BooleanFieldValue,
    DictionaryBlock,
    OAuth2BlockCredentialsPlacementValue,
    OAuth2BlockTokenPlacementValue,
    OAuth2GrantType,
    OAuth2ViaAuthorizationCodeBlockKeys,
    getMandatoryKeysForOAuth2Block,
    isDictionaryBlockSimpleField,
    AuthBlockNamesExcludingOAuth2,
    OAuth2AuthBlocksCommonKeys,
    OAuth2BlockTokenSourceValue,
    isAuthBlock,
    AkamaiEdgeGridAuthBlockKeys,
    getActiveSimpleFieldFromDictionaryBlockIfExistsOnce,
    OAuth1AuthBlockKeys,
    OAuth1SignatureMethod,
    OAuth1Placement,
} from "@global_shared";
import { checkNoDuplicateKeysAreDefinedForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoDuplicateKeysAreDefinedForDictionaryBlock";
import { checkNoKeysAreMissingForDictionaryBlock } from "./shared/checks/singleBlocks/checkNoKeysAreMissingForDictionaryBlock";
import { checkNoUnknownKeysAreDefinedInDictionaryBlock } from "./shared/checks/singleBlocks/checkNoUnknownKeysAreDefinedInDictionaryBlock";
import { checkValueForDictionaryBlockSimpleFieldIsValid } from "./shared/checks/singleBlocks/checkValueForDictionaryBlockSimpleFieldIsValid";
import { DiagnosticWithCode } from "./interfaces";
import { RelevantWithinAuthBlockDiagnosticCode } from "./shared/diagnosticCodes/relevantWithinAuthBlockDiagnosticCodeEnum";
import { KnownDiagnosticCode } from "./shared/diagnosticCodes/knownDiagnosticCodeDefinition";
import { doesDictionaryBlockFieldHaveValidIntegerValue } from "./shared/util/doesDictionaryBlockFieldHaveValidIntegerValue";
import { getDiagnosticForInvalidDictionaryBlockSimpleFieldValue } from "./shared/util/getDiagnosticForInvalidDictionaryBlockSimpleFieldValue";

export function getAuthBlockSpecificDiagnostics(
    filePath: string,
    authBlock: Block,
): (DiagnosticWithCode | undefined)[] {
    if (!isBlockDictionaryBlock(authBlock)) {
        return [];
    }

    if (
        isAuthBlock(authBlock.name) &&
        authBlock.name != AuthBlockName.OAuth2Auth
    ) {
        return getDiagnosticsForNonOAuth2AuthBlock(filePath, authBlock);
    } else if (authBlock.name == AuthBlockName.OAuth2Auth) {
        return getDiagnosticsForOAuth2AuthBlock(filePath, authBlock);
    }

    return [];
}

function getDiagnosticsForNonOAuth2AuthBlock(
    filePath: string,
    authBlock: DictionaryBlock,
) {
    const result: (DiagnosticWithCode | undefined)[] = [];

    const mandatoryKeys = getMandatoryKeysForNonOAuth2Block(
        authBlock.name as AuthBlockNamesExcludingOAuth2,
    );

    result.push(
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
            filePath,
            authBlock,
            RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
            mandatoryKeys,
        ) ?? []),
    );

    if (authBlock.name == AuthBlockName.ApiKeyAuth) {
        return result.concat(
            ...checkValuesForFields(authBlock, [
                {
                    key: ApiKeyAuthBlockKeys.Placement,
                    allowedValues: Object.values(ApiKeyAuthBlockPlacementValue),
                    diagnosticCode:
                        RelevantWithinAuthBlockDiagnosticCode.InvalidApiKeyAuthValueForPlacement,
                },
            ]),
        );
    }

    if (authBlock.name == AuthBlockName.AkamaiEdgeGridAuth) {
        // All fields in the settings block are simple dictionary fields.
        const fieldForMaxBodySize =
            getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
                [authBlock],
                authBlock.name,
                AkamaiEdgeGridAuthBlockKeys.MaxBodySize,
            );
        if (!fieldForMaxBodySize) {
            return result;
        }

        return result.concat(
            // A fallback is used, if no value is defined.
            fieldForMaxBodySize.value.length == 0 ||
                doesDictionaryBlockFieldHaveValidIntegerValue(
                    fieldForMaxBodySize,
                    0,
                )
                ? undefined
                : getDiagnosticForInvalidDictionaryBlockSimpleFieldValue(
                      fieldForMaxBodySize,
                      "Only non-negative integer values are allowed.",
                      RelevantWithinAuthBlockDiagnosticCode.AkamaiEdgeGrid_MaxBodySizeValueInvalid,
                  ),
        );
    }

    if (authBlock.name == AuthBlockName.OAuth1Auth) {
        // All fields in the settings block are simple dictionary fields.
        const fieldForSignatureMethod =
            getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
                [authBlock],
                authBlock.name,
                OAuth1AuthBlockKeys.SignatureMethod,
            );
        const fieldForPlacement =
            getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
                [authBlock],
                authBlock.name,
                OAuth1AuthBlockKeys.Placement,
            );
        const fieldForIncludeBodyHash =
            getActiveSimpleFieldFromDictionaryBlockIfExistsOnce(
                [authBlock],
                authBlock.name,
                OAuth1AuthBlockKeys.IncludeBodyHash,
            );

        return result.concat(
            fieldForSignatureMethod
                ? checkValueForDictionaryBlockSimpleFieldIsValid(
                      fieldForSignatureMethod,
                      Object.values(OAuth1SignatureMethod),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth1SignatureMethodValue,
                  )
                : undefined,
            fieldForPlacement
                ? checkValueForDictionaryBlockSimpleFieldIsValid(
                      fieldForPlacement,
                      Object.values(OAuth1Placement),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth1PlacementValue,
                  )
                : undefined,
            fieldForIncludeBodyHash
                ? checkValueForDictionaryBlockSimpleFieldIsValid(
                      fieldForIncludeBodyHash,
                      Object.values(BooleanFieldValue),
                      RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth1IncludeBodyHashValue,
                  )
                : undefined,
        );
    }

    return result;
}

function getDiagnosticsForOAuth2AuthBlock(
    filePath: string,
    authBlock: DictionaryBlock,
): (DiagnosticWithCode | undefined)[] {
    const diagnostics: (DiagnosticWithCode | undefined)[] = [];

    const grantTypeFields = authBlock.content.filter(
        ({ key }) => key == OAuth2ViaAuthorizationCodeBlockKeys.GrantType,
    );

    const diagnosticsForGrantTypeField: (DiagnosticWithCode | undefined)[] = [];

    diagnosticsForGrantTypeField.push(
        checkNoKeysAreMissingForDictionaryBlock(
            authBlock,
            [OAuth2ViaAuthorizationCodeBlockKeys.GrantType],
            RelevantWithinAuthBlockDiagnosticCode.KeysMissingInAuthBlock,
        ),
        ...(checkNoDuplicateKeysAreDefinedForDictionaryBlock(
            filePath,
            authBlock,
            RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
            [OAuth2ViaAuthorizationCodeBlockKeys.GrantType],
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
        ...checkOAuth2FieldsDependingOnGrantType(
            filePath,
            authBlock,
            grantType,
        ),
    );

    return diagnostics;
}

function checkValuesForOAuth2FieldsCommonForAllGrantTypes(
    authBlock: DictionaryBlock,
) {
    return checkValuesForFields(authBlock, [
        {
            key: OAuth2AuthBlocksCommonKeys.TokenPlacement,
            allowedValues: Object.values(OAuth2BlockTokenPlacementValue),
            diagnosticCode:
                RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForTokenPlacement,
        },
        {
            key: OAuth2AuthBlocksCommonKeys.TokenSource,
            allowedValues: Object.values(OAuth2BlockTokenSourceValue),
            diagnosticCode:
                RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForTokenSource,
        },
        {
            key: OAuth2ViaAuthorizationCodeBlockKeys.AutoFetchToken,
            allowedValues: Object.values(BooleanFieldValue),
            diagnosticCode:
                RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForAutoFetchToken,
        },
    ]);
}

function checkOAuth2FieldsDependingOnGrantType(
    filePath: string,
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
            filePath,
            authBlock,
            RelevantWithinAuthBlockDiagnosticCode.DuplicateKeysDefinedInAuthBlock,
            mandatoryKeys,
        ) ?? []),
    );

    if (grantType == OAuth2GrantType.AuthorizationCode) {
        diagnostics.push(
            ...checkValuesForFields(authBlock, [
                {
                    key: OAuth2ViaAuthorizationCodeBlockKeys.Pkce,
                    allowedValues: Object.values(BooleanFieldValue),
                    diagnosticCode:
                        RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForPkce,
                },
            ]),
        );
    }

    if (grantType != OAuth2GrantType.Implicit) {
        diagnostics.push(
            ...checkValuesForFields(authBlock, [
                {
                    key: OAuth2ViaAuthorizationCodeBlockKeys.CredentialsPlacement,
                    allowedValues: Object.values(
                        OAuth2BlockCredentialsPlacementValue,
                    ),
                    diagnosticCode:
                        RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForCredentialsPlacement,
                },
                {
                    key: OAuth2ViaAuthorizationCodeBlockKeys.AutoRefreshToken,
                    allowedValues: Object.values(BooleanFieldValue),
                    diagnosticCode:
                        RelevantWithinAuthBlockDiagnosticCode.InvalidOAuth2ValueForAutoRefreshToken,
                },
            ]),
        );
    }

    return diagnostics;
}

function checkValuesForFields(
    authBlock: DictionaryBlock,
    toCheck: {
        key: string;
        allowedValues: string[];
        diagnosticCode: KnownDiagnosticCode;
    }[],
): (DiagnosticWithCode | undefined)[] {
    return toCheck.map(({ key: keyToCheck, allowedValues, diagnosticCode }) => {
        const matchingFields = authBlock.content.filter(
            ({ key }) => key == keyToCheck,
        );

        return matchingFields.length == 1 &&
            isDictionaryBlockSimpleField(matchingFields[0])
            ? checkValueForDictionaryBlockSimpleFieldIsValid(
                  matchingFields[0],
                  allowedValues,
                  diagnosticCode,
              )
            : undefined;
    });
}
