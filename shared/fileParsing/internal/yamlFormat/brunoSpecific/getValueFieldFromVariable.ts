import { isMap, isScalar, Scalar, YAMLMap } from "yaml";
import { Range, WithKeyAndValueRange, YamlParsingError } from "../../../..";
import {
    VariableType,
    EnvironmentVariableProperty,
    CommonParsingArgs,
} from "../interfaces";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getErrorForValueWithUnexpectedType } from "../parsingErrors/getErrorForValueWithUnexpectedType";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import { getRangeForItem } from "../util/getRangeForItem";
import { getRangeForUnknownYamlItem } from "../util/getRangeForUnknownYamlItem";
import { getMapItems } from "../yamlMaps/getMapItems";

enum VariableValueWithTypeProperty {
    Type = "type",
    Data = "data",
}

export function getValueFieldFromVariable(
    variableDefinitionMap: YAMLMap,
    commonParams: CommonParsingArgs,
):
    | {
          keyRange: Range;
          value:
              | { valueRange: Range; value: string }
              | {
                    data: WithKeyAndValueRange<string>;
                    type: WithKeyAndValueRange<VariableType>;
                };
      }
    | { errors: YamlParsingError[] }
    | undefined {
    const { fullDocumentRange } = commonParams;

    const matchingField = variableDefinitionMap.items.find(
        ({ key }) =>
            isScalar<string>(key) &&
            key.value == EnvironmentVariableProperty.Value,
    );

    if (!matchingField) {
        // Field is optional. Is not necessarily an error, if it's missing.
        return undefined;
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
                  keyRange,
                  value: {
                      value: maybeTypedValue.item.value,
                      valueRange: getRangeForItem(
                          maybeTypedValue.item,
                          commonParams,
                      ),
                  },
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

    return collectedErrors.length > 0 || !data || !maybeType
        ? { errors: collectedErrors }
        : {
              keyRange,
              value: {
                  data,
                  type: maybeType.value,
              },
          };
}
