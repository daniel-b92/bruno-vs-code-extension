import { YAMLMap, YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedAssertion,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";
import {
    AssertionMapProperty,
    AssertionOperator,
} from "../../../external/yamlFormat/constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseAssertionsFromYamlSequence(
    assertionsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<ParsedAssertion[]> {
    const result: ParsedAssertion[] = [];
    const errors: YamlParsingError[] = [];

    const { items: assertionMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: assertionsSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = Object.values(AssertionMapProperty);

    for (const currentMap of assertionMaps) {
        const {
            items: {
                unknownKeys,
                missingKeys,
                validScalars: { withStringValue: validStringScalars },
            },
            errors: mapItemErrors,
        } = getMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                },
            },
            commonArgs,
        );

        errors.push(
            ...mapItemErrors.concat(
                unknownKeys.map(({ key, keyRange }) =>
                    getErrorForUnknownKeyInMap({
                        ...commonArgs,
                        unknownKey: key,
                        keyRange,
                        allowedKeys: keysForStringScalars,
                    }),
                ),
                missingKeys
                    .map((key) =>
                        getMandatoryKeysForMap().includes(key)
                            ? getErrorForMissingKeyInMap({
                                  ...commonArgs,
                                  map: currentMap,
                                  missingKey: key,
                              })
                            : undefined,
                    )
                    .filter((val) => val != undefined),
            ),
        );
        const { errors: parsingErrors, result: currentAssertion } =
            parseAssertion(
                currentMap,
                commonArgs,
                validStringScalars,
                missingKeys,
            );
        errors.push(...parsingErrors);
        if (!currentAssertion) {
            continue;
        }
        result.push(currentAssertion);
    }

    return {
        result,
        errors,
    };
}

function parseAssertion(
    yamlMap: YAMLMap,
    commonArgs: CommonParsingArgs,
    validStringScalars: WithKeyKeyRangeAndValueRange<string>[],
    missingKeys: string[],
): MaybeResultWithErrors<ParsedAssertion> {
    const collectedErrors: YamlParsingError[] = [];
    const missingProperties = missingKeys.map((key) => ({
        alwaysHasScalarValue: true,
        isMandatory: getMandatoryKeysForMap().includes(key),
        key,
    }));
    const maybeExpressionWithKey = validStringScalars.find(
        ({ key }) => key == AssertionMapProperty.Expression,
    );
    const maybeValueWithKey = validStringScalars.find(
        ({ key }) => key == AssertionMapProperty.Value,
    );
    const maybeDescriptionWithKey = validStringScalars.find(
        ({ key }) => key == AssertionMapProperty.Description,
    );
    const maybeUntypedOperatorWithKey = validStringScalars.find(
        ({ key }) => key == AssertionMapProperty.Operator,
    );

    const maybeTypedOperator = !maybeUntypedOperatorWithKey
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(AssertionOperator),
                  allStringValues: [maybeUntypedOperatorWithKey],
                  keyName: AssertionMapProperty.Operator,
              },
              collectedErrors,
          );

    return {
        errors: collectedErrors,
        result: {
            valueRange: getRangeForItem(yamlMap, commonArgs),
            missingProperties,
            properties: {
                expression: maybeExpressionWithKey
                    ? stripKeyFromResult(maybeExpressionWithKey)
                    : undefined,
                operator: maybeTypedOperator?.value,
                value: maybeValueWithKey
                    ? stripKeyFromResult(maybeValueWithKey)
                    : undefined,
                description: maybeDescriptionWithKey
                    ? stripKeyFromResult(maybeDescriptionWithKey)
                    : undefined,
            },
        },
    };
}

function getMandatoryKeysForMap() {
    return [
        AssertionMapProperty.Expression,
        AssertionMapProperty.Operator,
    ] as string[];
}
