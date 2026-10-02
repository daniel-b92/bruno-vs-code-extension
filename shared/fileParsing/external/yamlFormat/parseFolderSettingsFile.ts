import {
    BrunoFileType,
    ParsedFolderSettingsFile,
    ParsedInfoForFolderSettings,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedDocsWithType,
    WithKeyAndKeyRange,
} from "../../internal/yamlFormat/interfaces";
import { getValidatedMapItems } from "../../internal/yamlFormat/yamlMaps/getValidatedMapItems";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseFileInfoFromYamlMap";
import { YAMLMap } from "yaml";
import { parseHeadersFromSequence } from "../../internal/yamlFormat/brunoSpecific/parseHeadersFromSequence";
import { parseAuthFromYamlMapOrScalar } from "../../internal/yamlFormat/brunoSpecific/parseAuthFromYamlMapOrScalar";
import { parseVariablesFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseVariablesFromYamlSequence";
import { parseScriptsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseScriptsFromYamlSequence";
import { parseActionsFromYamlSequence } from "../../internal/yamlFormat/brunoSpecific/parseActionsFromYamlSequence";
import {
    FolderSettingsRequestSectionProperty,
    TopLevelFolderSettingsProperty,
} from "./constants/folderSettingsFileConstants";
import { parseDocsFromYamlMap } from "../../internal/yamlFormat/brunoSpecific/parseDocsFromYamlMap";
import { parseIfPresent } from "../../internal/yamlFormat/util/parseIfPresent";
import { getRangeForItem } from "../../internal/yamlFormat/util/getRangeForItem";

export function parseFolderSettingsFile(
    docHelper: TextDocumentHelper,
): MaybeResultWithErrors<ParsedFolderSettingsFile> {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap;
    }

    const { getMap, missingProperties } = getValidatedMapItems(
        maybeTopLevelMap.map,
        {
            // Docs section is always a Yaml map for folder settings files.
            mapValues: Object.values(TopLevelFolderSettingsProperty),
            mandatoryKeys: [TopLevelFolderSettingsProperty.Info],
        },
        commonArgs,
        collectedErrors,
    );

    const requestMap = getMap(TopLevelFolderSettingsProperty.Request);
    const info: ParsedInfoForFolderSettings | undefined = parseIfPresent(
        getMap(TopLevelFolderSettingsProperty.Info),
        (infoMap) =>
            parseFileInfoFromYamlMap({
                infoMap,
                commonArgs,
                fileType: BrunoFileType.FolderSettingsFile,
            }),
        collectedErrors,
    );
    const request = requestMap
        ? parseRequestSection(requestMap, commonArgs, collectedErrors)
        : undefined;
    const docs: ParsedDocsWithType | undefined = parseIfPresent(
        getMap(TopLevelFolderSettingsProperty.Docs),
        (docsMap) => parseDocsFromYamlMap(docsMap, commonArgs),
        collectedErrors,
    );

    return {
        errors: collectedErrors,
        result: { properties: { info, request, docs }, missingProperties },
    };
}

function parseRequestSection(
    { keyRange, value: requestMap }: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const { getString, getMap, getSequence, missingProperties } =
        getValidatedMapItems(
            requestMap,
            {
                // Auth can either be a Scalar string with the value 'inherit' or a map with a specific type.
                scalars: {
                    stringValues: [FolderSettingsRequestSectionProperty.Auth],
                },
                mapValues: [FolderSettingsRequestSectionProperty.Auth],
                sequenceValues: [
                    FolderSettingsRequestSectionProperty.Headers,
                    FolderSettingsRequestSectionProperty.Variables,
                    FolderSettingsRequestSectionProperty.Scripts,
                    FolderSettingsRequestSectionProperty.Actions,
                ],
                // None of the properties are mandatory.
            },
            commonArgs,
            collectedErrors,
        );

    return {
        keyRange,
        valueRange: getRangeForItem(requestMap, commonArgs),
        missingProperties,
        properties: {
            headers: parseIfPresent(
                getSequence(FolderSettingsRequestSectionProperty.Headers),
                ({ value: headersSequence }) =>
                    parseHeadersFromSequence({ commonArgs, headersSequence }),
                collectedErrors,
            ),
            auth: parseIfPresent(
                getString(FolderSettingsRequestSectionProperty.Auth) ??
                    getMap(FolderSettingsRequestSectionProperty.Auth),
                (authMapOrScalar) =>
                    parseAuthFromYamlMapOrScalar({
                        commonArgs,
                        authMapOrScalar,
                    }),
                collectedErrors,
            ),
            variables: parseIfPresent(
                getSequence(FolderSettingsRequestSectionProperty.Variables),
                ({ value }) =>
                    parseVariablesFromYamlSequence(value, commonArgs),
                collectedErrors,
            ),
            scripts: parseIfPresent(
                getSequence(FolderSettingsRequestSectionProperty.Scripts),
                ({ value }) => parseScriptsFromYamlSequence(value, commonArgs),
                collectedErrors,
            ),
            actions: parseIfPresent(
                getSequence(FolderSettingsRequestSectionProperty.Actions),
                ({ value }) => parseActionsFromYamlSequence(value, commonArgs),
                collectedErrors,
            ),
        },
    };
}
