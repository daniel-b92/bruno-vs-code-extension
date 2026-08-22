import { isMap, YAMLMap } from "yaml";
import { WithKeyAndValueRange, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedDocsWithType,
    ParsedYamlMap,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getMapItems } from "../yamlMaps/getMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { DocsProperty, DocsType } from "./constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseDocsFromYamlMapOrScalar(
    docsMapOrScalar:
        | WithKeyAndKeyRange<YAMLMap>
        | WithKeyKeyRangeAndValueRange<string | null>,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedDocsWithType> {
    const { keyRange } = docsMapOrScalar;

    if (!isMap(docsMapOrScalar.value)) {
        return {
            errors: [],
            result:
                docsMapOrScalar === null
                    ? undefined
                    : stripKeyFromResult(
                          docsMapOrScalar as WithKeyKeyRangeAndValueRange<string>,
                      ),
        };
    }

    const valueRange = getRangeForItem(docsMapOrScalar.value, commonArgs);
    const { errors, result: value } = parseFromMap(
        docsMapOrScalar.value,
        commonArgs,
    );
    return {
        result: value ? { keyRange, value, valueRange } : undefined,
        errors,
    };
}

function parseFromMap(
    docsMap: YAMLMap,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<
    | string
    | ParsedYamlMap<{
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
        hasScalarValue: true,
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
        result:
            content || maybeType
                ? {
                      properties: { content, type: maybeType?.value },
                      missingProperties,
                  }
                : undefined,
    };
}
