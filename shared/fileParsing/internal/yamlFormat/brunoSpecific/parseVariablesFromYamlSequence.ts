import { isScalar, YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    ParsedRequestVariable,
    ParsingResult,
    RequestVariableProperty,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { getValueFieldFromVariable } from "./getValueFieldFromVariable";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import { mapFromYamlScalar } from "../scalars/mapFromYamlScalar";

export function parseVariablesFromYamlSequence(
    variablesSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): ParsingResult<{
    enabled: ParsedRequestVariable[];
    disabled: ParsedRequestVariable[];
}> {
    const variables: ParsedRequestVariable[] = [];
    const errors: YamlParsingError[] = [];

    const { items: variableMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: variablesSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = [
        RequestVariableProperty.Description,
        RequestVariableProperty.Name,
    ];
    const keysForBooleanScalars = [RequestVariableProperty.Disabled];

    for (const currentMap of variableMaps) {
        const {
            items: {
                unknownKeys,
                missingKeys,
                validScalars: {
                    withStringValue: validStringScalars,
                    withBooleanValue: validBooleanScalars,
                },
            },
            errors: mapItemErrors,
        } = getMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                },
            },
            commonArgs,
        );
        const allAllowedKeys = Object.values(RequestVariableProperty);

        errors.push(
            ...mapItemErrors.concat(
                unknownKeys
                    .filter(
                        ({ key }) =>
                            !(allAllowedKeys as string[]).includes(key),
                    )
                    .map(({ key, keyRange }) =>
                        getErrorForUnknownKeyInMap({
                            ...commonArgs,
                            unknownKey: key,
                            keyRange,
                            allowedKeys: allAllowedKeys,
                        }),
                    ),
            ),
        );
        const { description, disabled } =
            getItemsForSimpleOptionalVariableProps(
                validStringScalars,
                validBooleanScalars,
            );

        const maybeValue = getValueFieldFromVariable(currentMap, commonArgs);
        if (maybeValue && "errors" in maybeValue) {
            errors.push(...maybeValue.errors);
        }

        const valueToUse =
            maybeValue && !("errors" in maybeValue) ? maybeValue : undefined;

        const name = validStringScalars.find(
            ({ key }) => key == RequestVariableProperty.Name,
        );

        if (!name) {
            // The 'name' field is the only mandatory one.
            errors.push(
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    missingKey: RequestVariableProperty.Name,
                    map: currentMap,
                }),
            );
            continue;
        }

        variables.push({
            missingProperties: missingKeys as RequestVariableProperty[],
            fields: {
                name: stripKeyFromResult(name),
                description,
                disabled,
                value: !valueToUse
                    ? undefined
                    : isScalar<string>(valueToUse.value)
                      ? mapFromYamlScalar({
                            ...commonArgs,
                            keyRange: valueToUse.keyRange,
                            value: valueToUse.value,
                        })
                      : {
                            ...valueToUse,
                            ...valueToUse.value,
                        },
            },
        });
    }

    return {
        result: {
            enabled: variables.filter(
                ({
                    fields: {
                        disabled: { effectiveValue },
                    },
                }) => !effectiveValue,
            ),
            disabled: variables.filter(
                ({
                    fields: {
                        disabled: { effectiveValue },
                    },
                }) => effectiveValue,
            ),
        },
        errors,
    };
}

function getItemsForSimpleOptionalVariableProps(
    validStringScalars: WithKeyKeyRangeAndValueRange<string>[],
    validBooleanScalars: WithKeyKeyRangeAndValueRange<boolean>[],
) {
    const maybeDescriptionWithKeyRange = validStringScalars.find(
        ({ key }) => key == RequestVariableProperty.Description,
    );
    const maybeDisabledWithKeyRange = validBooleanScalars.find(
        ({ key }) => key == RequestVariableProperty.Disabled,
    );
    // The default value for 'disabled' is false, when not defined.
    const disabledEffectiveValue =
        maybeDisabledWithKeyRange !== undefined
            ? maybeDisabledWithKeyRange.value
            : false;

    return {
        description: maybeDescriptionWithKeyRange
            ? stripKeyFromResult(maybeDescriptionWithKeyRange)
            : undefined,
        disabled: maybeDisabledWithKeyRange
            ? {
                  effectiveValue: disabledEffectiveValue,
                  field: stripKeyFromResult(maybeDisabledWithKeyRange),
              }
            : {
                  effectiveValue: disabledEffectiveValue,
              },
    };
}
