import { isMap, isScalar, Scalar, YAMLMap } from "yaml";
import { Range, WithKeyAndValueRange, YamlParsingError } from "../../../..";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedYamlMapWithKeyAndValueRange,
} from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getErrorForValueWithUnexpectedType } from "../parsingErrors/getErrorForValueWithUnexpectedType";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getRangeForItem } from "../util/getRangeForItem";
import { getRangeForUnknownYamlItem } from "../util/getRangeForUnknownYamlItem";
import { getMapItems } from "../yamlMaps/getMapItems";
import { VariableType } from "../../../external/yamlFormat/constants/sharedConstants";
import { EnvironmentVariableProperty } from "../../../external/yamlFormat/constants/environmentFileConstants";
import { stripKeyFromResult } from "../util/stripKeyFromResult";

enum VariableValueWithTypeProperty {
    Type = "type",
    Data = "data",
}

export function getValueFieldFromVariable(
    variableDefinitionMap: YAMLMap,
    commonParams: CommonParsingArgs,
):
    | MaybeResultWithErrors<WithKeyAndValueRange<string>>
    | MaybeResultWithErrors<
          ParsedYamlMapWithKeyAndValueRange<{
              type?: WithKeyAndValueRange<VariableType>;
              data?: WithKeyAndValueRange<string>;
          }>
      > {
    const { fullDocumentRange } = commonParams;

    const matchingField = variableDefinitionMap.items.find(
        ({ key }) =>
            isScalar<string>(key) &&
            key.value == EnvironmentVariableProperty.Value,
    );

    if (!matchingField) {
        // Field is optional. Is not necessarily an error, if it's missing.
        return { errors: [] };
    }

    const keyRange = getRangeForItem(
        matchingField.key as Scalar<string>,
        commonParams,
    );

    if (!isMap(matchingField.value)) {
        const maybeTypedValue:
            { item: Scalar<string> } | { error: YamlParsingError } =
            isScalar<string>(matchingField.value)
                ? { item: matchingField.value }
                : {
                      error: getErrorForValueWithUnexpectedType({
                          ...commonParams,
                          key: EnvironmentVariableProperty.Value,
                          expectedType: "Scalar",
                          valueRange: (getRangeForUnknownYamlItem(
                              matchingField.value,
                          ) ?? fullDocumentRange) as Range,
                      }),
                  };

        return "error" in maybeTypedValue
            ? { errors: [maybeTypedValue.error] }
            : {
                  result: {
                      keyRange,
                      valueRange: getRangeForItem(
                          maybeTypedValue.item,
                          commonParams,
                      ),
                      value: maybeTypedValue.item.value,
                  },
                  errors: [],
              };
    }

    const collectedErrors: YamlParsingError[] = [];
    const valueMapItem = matchingField.value;
    const keysForStringScalars = [
        VariableValueWithTypeProperty.Data,
        VariableValueWithTypeProperty.Type,
    ];

    const { items: valueMapItems, errors: mapItemErrors } = getMapItems(
        valueMapItem,
        {
            scalars: {
                stringValues: keysForStringScalars,
            },
            sequenceValues: [],
        },
        commonParams,
    );

    const {
        missingKeys,
        unknownKeys,
        validScalars: { withStringValue: validStringScalars },
    } = valueMapItems;
    collectedErrors.push(
        ...mapItemErrors.concat(
            unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonParams,
                    unknownKey: key,
                    keyRange,
                    allowedKeys: keysForStringScalars,
                }),
            ),
            missingKeys.map((key) =>
                getErrorForMissingKeyInMap({
                    ...commonParams,
                    missingKey: key,
                    map: valueMapItem,
                }),
            ),
        ),
    );
    const missingProperties = missingKeys.map((key) => ({
        alwaysHasScalarValue: true,
        // All properties are mandatory.
        isMandatory: true,
        key,
    }));

    const data = validStringScalars.find(
        ({ key }) => key == VariableValueWithTypeProperty.Data,
    );

    const maybeType = getTypedValueFromList(
        {
            allowedValues: Object.values(VariableType),
            allStringValues: validStringScalars,
            keyName: VariableValueWithTypeProperty.Type,
        },
        collectedErrors,
    );

    return {
        result: {
            keyRange,
            valueRange: getRangeForItem(valueMapItem, commonParams),
            properties: {
                data: data ? stripKeyFromResult(data) : undefined,
                type: maybeType?.value,
            },
            missingProperties,
        },
        errors: collectedErrors,
    };
}
