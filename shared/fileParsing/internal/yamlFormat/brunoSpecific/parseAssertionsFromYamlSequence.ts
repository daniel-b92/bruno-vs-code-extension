import { YAMLMap, YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedAssertion,
} from "../interfaces";
import { YamlMapMissingPropertyInfo, YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import {
    ValidatedMapItems,
    getValidatedMapItems,
} from "../yamlMaps/getValidatedMapItems";
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
        const { getString, missingProperties } = getValidatedMapItems(
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
                getString,
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
    getString: ValidatedMapItems["getString"],
    missingProperties: YamlMapMissingPropertyInfo[],
): MaybeResultWithErrors<ParsedAssertion> {
    const collectedErrors: YamlParsingError[] = [];
    const maybeExpressionWithKey = getString(AssertionMapProperty.Expression);
    const maybeValueWithKey = getString(AssertionMapProperty.Value);
    const maybeDescriptionWithKey = getString(AssertionMapProperty.Description);
    const maybeUntypedOperatorWithKey = getString(
        AssertionMapProperty.Operator,
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
                expression: stripKeyFromResult(maybeExpressionWithKey),
                operator: maybeTypedOperator?.value,
                value: stripKeyFromResult(maybeValueWithKey),
                description: stripKeyFromResult(maybeDescriptionWithKey),
            },
        },
    };
}
