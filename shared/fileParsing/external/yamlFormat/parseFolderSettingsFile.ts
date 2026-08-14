import {
    BrunoFileType,
    ParsedFolderSettingsFile,
    ParsedInfoForFolderSettings,
    TextDocumentHelper,
    YamlParsingError,
} from "../../..";
import {
    CommonParsingArgs,
    FolderSettingsRequestSectionProperty,
    ParsingResult,
    TopLevelFolderSettingsProperty,
    WithKeyAndKeyRange,
} from "../../internal/yamlFormat/interfaces";
import { getMapItems } from "../../internal/yamlFormat/yamlMaps/getMapItems";
import { getErrorForMissingKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForMissingKeyInMap";
import { parseDocumentIntoYamlMap } from "../../internal/yamlFormat/util/parseDocumentIntoYamlMap";
import { getErrorForUnknownKeyInMap } from "../../internal/yamlFormat/parsingErrors/getErrorForUnknownKeyInMap";
import { parseFileInfoFromYamlMap } from "../../internal/yamlFormat/yamlMaps/parseFileInfoFromYamlMap";
import { YAMLMap } from "yaml";
import { isParsingResultOnlyErrors } from "../../internal/yamlFormat/util/isParsingResultOnlyErrors";
import { parseHeadersFromSequence } from "../../internal/yamlFormat/yamlSequences/parseHeadersFromSequence";
import { parseAuthFromYamlMapOrScalar } from "../../internal/yamlFormat/yamlMaps/parseAuthFromYamlMapOrScalar";

type Result = ParsingResult<ParsedFolderSettingsFile>;

export function parseFolderSettingsFile(docHelper: TextDocumentHelper) {
    const commonArgs: CommonParsingArgs = {
        docHelper,
        fullDocumentRange: docHelper.getTextRange(),
    };
    const collectedErrors: YamlParsingError[] = [];
    const expectedTopLevelProperties = Object.values(
        TopLevelFolderSettingsProperty,
    );

    const maybeTopLevelMap = parseDocumentIntoYamlMap(commonArgs);
    if ("errors" in maybeTopLevelMap) {
        return maybeTopLevelMap.errors;
    }

    const { map: topLevelMap } = maybeTopLevelMap;
    const {
        items: { missingKeys, unknownKeys, validMaps },
        errors: mapItemErrors,
    } = getMapItems(
        topLevelMap,
        {
            scalars: {},
            mapValues: expectedTopLevelProperties,
        },
        commonArgs,
    );

    collectedErrors.push(
        ...mapItemErrors.concat(
            unknownKeys.map(({ key: unknownKey, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey,
                    keyRange,
                    allowedKeys: expectedTopLevelProperties,
                }),
            ),
        ),
    );
    const infoMap = validMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Info,
    );
    if (!infoMap || missingKeys.includes(TopLevelFolderSettingsProperty.Info)) {
        // The info property is the only mandatory one.
        return collectedErrors.concat(
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: TopLevelFolderSettingsProperty.Info,
                map: topLevelMap,
            }),
        );
    }
    const info = getParsedInfo(infoMap, commonArgs, collectedErrors);
}

function getParsedInfo(
    infoMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
): ParsedInfoForFolderSettings | undefined {
    const infoResult = parseFileInfoFromYamlMap({
        infoMap,
        commonArgs,
        fileType: BrunoFileType.FolderSettingsFile,
    }) as ParsingResult<ParsedInfoForFolderSettings>;
    const { info, errors: infoErrors } = isParsingResultOnlyErrors(infoResult)
        ? { info: undefined, errors: infoResult }
        : { info: infoResult.result, errors: infoResult.errors };
    collectedErrors.push(...infoErrors);

    return info;
}

function getParsedRequest(
    validSecondLevelMaps: WithKeyAndKeyRange<YAMLMap>[],
    commonArgs: CommonParsingArgs,
    collectedErrors: YamlParsingError[],
) {
    const requestMap = validSecondLevelMaps.find(
        ({ key }) => key == TopLevelFolderSettingsProperty.Request,
    );

    if (!requestMap) {
        return undefined;
    }
    const requestResult = parseFileInfoFromYamlMap({
        infoMap: requestMap,
        commonArgs,
        fileType: BrunoFileType.FolderSettingsFile,
    });
    const { info, errors: infoErrors } = isParsingResultOnlyErrors(
        requestResult,
    )
        ? { info: undefined, errors: requestResult }
        : { info: requestResult.result, errors: requestResult.errors };
    collectedErrors.push(...infoErrors);

    return info;
}

function parseRequestSection(
    requestMap: YAMLMap,
    commonArgs: CommonParsingArgs,
) {
    const collectedErrors: YamlParsingError[] = [];
    const expectedSequences = [
        FolderSettingsRequestSectionProperty.Headers,
        FolderSettingsRequestSectionProperty.Variables,
        FolderSettingsRequestSectionProperty.Scripts,
        FolderSettingsRequestSectionProperty.Actions,
    ];
    const expectedMaps = [FolderSettingsRequestSectionProperty.Auth];
    const expectedScalarStrings = [FolderSettingsRequestSectionProperty.Auth];
    const allowedKeys = expectedSequences.concat(expectedMaps);

    const {
        items: {
            unknownKeys,
            validMaps,
            validSequences,
            validScalars: { withStringValue: validStringScalars },
        },
        errors: sectionErrors,
    } = getMapItems(
        requestMap,
        {
            scalars: { stringValues: expectedScalarStrings },
            mapValues: allowedKeys,
        },
        commonArgs,
    );

    collectedErrors.push(
        ...sectionErrors.concat(
            unknownKeys.map(({ key: unknownKey, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    unknownKey,
                    keyRange,
                    allowedKeys,
                }),
            ),
        ),
    );

    const maybeHeadersSequence = validSequences.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Headers,
    );
    const parsedHeaders = maybeHeadersSequence
        ? parseHeadersFromSequence({
              commonArgs,
              headersSequence: maybeHeadersSequence.value,
          })
        : undefined;

    const maybeAuthScalar = validStringScalars.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Auth,
    );
    const maybeAuthMap = validMaps.find(
        ({ key }) => key == FolderSettingsRequestSectionProperty.Auth,
    );
    const authMapOrScalar = maybeAuthScalar ?? maybeAuthMap?.value;
    const parsedAuth = authMapOrScalar
        ? parseAuthFromYamlMapOrScalar({
              commonArgs,
              authMapOrScalar: authMapOrScalar,
          })
        : undefined;
}
