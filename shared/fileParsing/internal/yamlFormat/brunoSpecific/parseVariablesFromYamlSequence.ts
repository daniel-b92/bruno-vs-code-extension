import { YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    MaybeResultWithErrors,
    ParsedRequestVariable,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import { YamlParsingError } from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { getValidatedMapItems } from "../yamlMaps/getValidatedMapItems";
import { getValueFieldFromVariable } from "./getValueFieldFromVariable";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { RequestVariableProperty } from "../../../external/yamlFormat/constants/sharedConstants";
import { getRangeForItem } from "../util/getRangeForItem";

export function parseVariablesFromYamlSequence(
    variablesSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): MaybeResultWithErrors<{
    enabled: ParsedRequestVariable[];
    disabled: ParsedRequestVariable[];
}> {
    const enabledVariables: ParsedRequestVariable[] = [];
    const disabledVariables: ParsedRequestVariable[] = [];
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
                validScalars: {
                    withStringValue: validStringScalars,
                    withBooleanValue: validBooleanScalars,
                },
            },
            missingProperties,
        } = getValidatedMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                },
                mandatoryKeys: [RequestVariableProperty.Name],
                // The value gets parsed separately, because it can be either a scalar or a map.
                additionalAllowedKeys: [RequestVariableProperty.Value],
            },
            commonArgs,
            errors,
        );
        const { description, disabled } =
            getItemsForSimpleOptionalVariableProps(
                validStringScalars,
                validBooleanScalars,
            );

        const { result: maybeValue, errors: valueErrors } =
            getValueFieldFromVariable(currentMap, commonArgs);
        errors.push(...valueErrors);

        const name = validStringScalars.find(
            ({ key }) => key == RequestVariableProperty.Name,
        );

        const variable: ParsedRequestVariable = {
            valueRange: getRangeForItem(currentMap, commonArgs),
            missingProperties,
            properties: {
                name: name ? stripKeyFromResult(name) : undefined,
                description,
                disabled,
                value: maybeValue,
            },
        };

        if (variable.properties.disabled.effectiveValue) {
            disabledVariables.push(variable);
        } else {
            enabledVariables.push(variable);
        }
    }

    return {
        result: {
            enabled: enabledVariables,
            disabled: disabledVariables,
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
        disabled: {
            effectiveValue: disabledEffectiveValue,
            field: maybeDisabledWithKeyRange
                ? stripKeyFromResult(maybeDisabledWithKeyRange)
                : undefined,
        },
    };
}
