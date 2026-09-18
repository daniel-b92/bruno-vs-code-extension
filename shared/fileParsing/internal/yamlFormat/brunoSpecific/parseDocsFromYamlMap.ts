import { YAMLMap } from "yaml";
import { WithKeyAndValueRange, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedDocsWithType,
    ParsedYamlMap,
    WithKeyAndKeyRange,
} from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getMapItems } from "../yamlMaps/getMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import {
    DocsProperty,
    DocsType,
} from "../../../external/yamlFormat/constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseDocsFromYamlMap(
    docsMap: WithKeyAndKeyRange<YAMLMap>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedDocsWithType> {
    const { keyRange, value: map } = docsMap;

    const { errors, result: value } = parseFromMap(map, commonArgs);
    return {
        result: value
            ? { keyRange, value, valueRange: getRangeForItem(map, commonArgs) }
            : undefined,
        errors,
    };
}

function parseFromMap(
    docsMap: YAMLMap,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    ParsedYamlMap<{
        type?: WithKeyAndValueRange<DocsType>;
        content?: WithKeyAndValueRange<string>;
    }>
> {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = Object.values(DocsProperty);

    const {
        items: {
            missingKeys,
            unknownKeys,
            validScalars: { withStringValue: validStringScalars },
        },
        errors: mapItemErrors,
    } = getMapItems(
        docsMap,
        {
            scalars: {
                stringValues: expectedStringScalars,
            },
        },
        commonArgs,
    );

    errors.push(
        ...mapItemErrors,
        ...unknownKeys.map(({ key: unknownKey, keyRange }) =>
            getErrorForUnknownKeyInMap({
                ...commonArgs,
                unknownKey,
                keyRange,
                allowedKeys: expectedStringScalars,
            }),
        ),
        ...missingKeys.map((key) =>
            getErrorForMissingKeyInMap({
                ...commonArgs,
                missingKey: key,
                map: docsMap,
            }),
        ),
    );
    const missingProperties = missingKeys.map((key) => ({
        alwaysHasScalarValue: true,
        isMandatory: false,
        key,
    }));
    const content = validStringScalars.find(
        ({ key }) => key == DocsProperty.Content,
    );
    const untypedType = validStringScalars.find(
        ({ key }) => key == DocsProperty.Type,
    );
    const maybeType = !untypedType
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(DocsType),
                  allStringValues: [untypedType],
                  keyName: DocsProperty.Type,
              },
              errors,
          );

    return {
        errors,
        result: {
            properties: {
                content: content ? stripKeyFromResult(content) : undefined,
                type: maybeType?.value,
            },
            missingProperties,
        },
    };
}
