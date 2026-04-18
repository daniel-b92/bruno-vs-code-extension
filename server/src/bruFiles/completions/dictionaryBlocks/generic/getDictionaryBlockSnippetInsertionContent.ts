import {
    ApiKeyAuthBlockKeys,
    ApiKeyAuthBlockPlacementValue,
    AuthBlockName,
    AuthBlockNamesExcludingOAuth2,
    AuthModeBlockKey,
    BooleanFieldValue,
    BrunoFileType,
    getDefaultIndentationForDictionaryBlockFields,
    getExtensionForBrunoFiles,
    getMandatoryKeysForMethodBlock,
    getMandatoryKeysForNonOAuth2Block,
    getMandatoryKeysForSettingsBlock,
    getMetaBlockMandatoryKeys,
    getPossibleMethodBlocks,
    isAuthBlock,
    LineBreakType,
    MetaBlockKey,
    MethodBlockAuthValues,
    MethodBlockBodies,
    MethodBlockKey,
    OAuth2AuthBlocksCommonKeys,
    OAuth2BlockTokenPlacementValue,
    OAuth2BlockTokenSourceValue,
    RequestFileBlockName,
    RequestType,
    SettingsBlockKey,
    SettingsFileSpecificBlock,
} from "@global_shared";
import {
    LanguageFeatureBaseRequest,
    TypedCollection,
} from "../../../../shared";
import { basename } from "path";
import { getSequenceValueCompletion } from "../../../shared/getSequenceValueCompletion";

interface CommonParams {
    baseRequest: LanguageFeatureBaseRequest;
    fileType: BrunoFileType;
    collection: TypedCollection;
    lineBreak: LineBreakType;
}

export function getDictionaryBlockSnippetInsertionContent(
    blockName: string,
    commonParams: CommonParams,
): string | undefined {
    const { lineBreak } = commonParams;
    if (blockName == RequestFileBlockName.Meta) {
        return getContentForMetaBlock(commonParams);
    }

    if ((getPossibleMethodBlocks() as string[]).includes(blockName)) {
        return getContentForMethodBlock(blockName, lineBreak);
    }

    if (blockName == RequestFileBlockName.Settings) {
        return getContentForSettingsBlock(lineBreak);
    }

    if (blockName == SettingsFileSpecificBlock.AuthMode) {
        return getContentForAuthModeBlock(lineBreak);
    }

    if (isAuthBlock(blockName)) {
        return getContentForAuthBlock(blockName, lineBreak);
    }
}

function getContentForMetaBlock({
    baseRequest: { filePath },
    collection,
    fileType,
    lineBreak,
}: CommonParams) {
    const mandatoryKeys = getMetaBlockMandatoryKeys(fileType);

    if (!mandatoryKeys) {
        return undefined;
    }

    const fields = mandatoryKeys.map((key) => {
        if (key == MetaBlockKey.Name) {
            return {
                key,
                predefinedValues: basename(
                    filePath,
                    getExtensionForBrunoFiles(),
                ),
            };
        }
        if (key == MetaBlockKey.Sequence) {
            const suggestedSequence = getSequenceValueCompletion(
                collection,
                filePath,
                fileType,
            );
            return {
                key,
                predefinedValues: suggestedSequence
                    ? suggestedSequence.toString()
                    : undefined,
            };
        }
        if (key == MetaBlockKey.Type) {
            return { key, predefinedValues: Object.values(RequestType) };
        }

        return { key };
    });

    return mandatoryKeys
        ? getContentForDictionaryBlock(fields, lineBreak)
        : undefined;
}

function getContentForMethodBlock(blockName: string, lineBreak: LineBreakType) {
    const mandatoryKeys = getMandatoryKeysForMethodBlock(blockName);

    return getContentForDictionaryBlock(
        mandatoryKeys.map((key) => ({
            key,
            predefinedValues:
                key == MethodBlockKey.Auth
                    ? Object.values(MethodBlockAuthValues)
                    : key == MethodBlockKey.Body
                      ? Object.values(MethodBlockBodies)
                      : undefined,
        })),
        lineBreak,
    );
}

function getContentForAuthBlock(blockName: string, lineBreak: LineBreakType) {
    if (blockName != AuthBlockName.OAuth2Auth) {
        const mandatoryKeys = getMandatoryKeysForNonOAuth2Block(
            blockName as AuthBlockNamesExcludingOAuth2,
        );

        const fields = mandatoryKeys.map((key) => ({
            key,
            predefinedValues:
                blockName == RequestFileBlockName.ApiKeyAuth &&
                key == ApiKeyAuthBlockKeys.Placement
                    ? Object.values(ApiKeyAuthBlockPlacementValue)
                    : undefined,
        }));
        return getContentForDictionaryBlock(fields, lineBreak);
    }

    const commonOAuth2Fields = Object.values(OAuth2AuthBlocksCommonKeys)
        // Ensure that the Grant type field is the last one.
        .sort((key1, key2) =>
            key1 == OAuth2AuthBlocksCommonKeys.GrantType
                ? 1
                : key2 == OAuth2AuthBlocksCommonKeys.GrantType
                  ? -1
                  : 0,
        )
        .map((key) => ({
            key,
            predefinedValues:
                key == OAuth2AuthBlocksCommonKeys.TokenPlacement
                    ? Object.values(OAuth2BlockTokenPlacementValue)
                    : key == OAuth2AuthBlocksCommonKeys.TokenSource
                      ? Object.values(OAuth2BlockTokenSourceValue)
                      : key == OAuth2AuthBlocksCommonKeys.AutoFetchToken
                        ? Object.values(BooleanFieldValue)
                        : undefined,
        }));

    return getContentForDictionaryBlock(
        commonOAuth2Fields,
        lineBreak,
        OAuth2AuthBlocksCommonKeys.GrantType,
    );
}

function getContentForSettingsBlock(lineBreak: LineBreakType) {
    const fields = getMandatoryKeysForSettingsBlock().map((key) => ({
        key,
        predefinedValues: [
            SettingsBlockKey.EncodeUrl,
            SettingsBlockKey.FollowRedirects,
        ].includes(key)
            ? Object.values(BooleanFieldValue)
            : key == SettingsBlockKey.FollowRedirects
              ? "5"
              : key == SettingsBlockKey.Timeout
                ? "inherit"
                : undefined,
    }));

    return getContentForDictionaryBlock(fields, lineBreak);
}

function getContentForAuthModeBlock(lineBreak: LineBreakType) {
    return getContentForDictionaryBlock(
        [
            {
                key: AuthModeBlockKey.Mode,
                // The same values are valid as for the auth field in method blocks.
                predefinedValues: Object.values(MethodBlockAuthValues),
            },
        ],
        lineBreak,
    );
}

function getContentForDictionaryBlock(
    fields: { key: string; predefinedValues?: string | string[] }[],
    lineBreak: LineBreakType,
    lastSelectedKeyWithoutPredefinedValues?: string,
) {
    const defaultFieldIndentation =
        getDefaultIndentationForDictionaryBlockFields();
    const fieldsWithSnippetIndizes = fields
        .filter(
            ({ predefinedValues }) =>
                predefinedValues != undefined &&
                Array.isArray(predefinedValues),
        )
        .map((field, index) => ({ ...field, snippetIndex: index + 1 }));

    return fields
        .map(({ key, predefinedValues }) => {
            const lineBegin = " "
                .repeat(defaultFieldIndentation)
                .concat(key, ":");

            if (!predefinedValues || !Array.isArray(predefinedValues)) {
                return predefinedValues
                    ? `${lineBegin} ${predefinedValues}`
                    : lastSelectedKeyWithoutPredefinedValues &&
                        key == lastSelectedKeyWithoutPredefinedValues
                      ? `${lineBegin}\${0}`
                      : lineBegin;
            }

            const snippetIndex = fieldsWithSnippetIndizes.find(
                ({ key: k }) => key == k,
            )!.snippetIndex;

            return `${lineBegin} $\{${snippetIndex}|${predefinedValues.join(",")}|\}`;
        })
        .join(lineBreak)
        .concat(lineBreak);
}
