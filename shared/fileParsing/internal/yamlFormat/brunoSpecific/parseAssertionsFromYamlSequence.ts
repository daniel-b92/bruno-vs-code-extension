import { YAMLMap, YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedAssertion,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YamlMapMissingPropertyInfo, YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
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
                validScalars: { withStringValue: validStringScalars },
            },
            missingProperties,
        } = getValidatedMapItems(
            currentMap,
            {
                scalars: { stringValues: keysForStringScalars },
                mandatoryKeys: [
                    AssertionMapProperty.Expression,
                    AssertionMapProperty.Operator,
                ],
            },
            commonArgs,
            errors,
        );
        const { errors: parsingErrors, result: currentAssertion } =
            parseAssertion(
                currentMap,
                commonArgs,
                validStringScalars,
                missingProperties,
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
    missingProperties: YamlMapMissingPropertyInfo[],
): MaybeResultWithErrors<ParsedAssertion> {
    const collectedErrors: YamlParsingError[] = [];
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
