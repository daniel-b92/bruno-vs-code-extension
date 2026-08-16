import { YAMLMap, YAMLSeq } from "yaml";
import {
    CommonParsingArgs,
    ParsedAction,
    ParsingResult,
    WithKeyAndKeyRange,
    WithKeyKeyRangeAndValueRange,
} from "../interfaces";
import {
    WithKeyAndValueRange,
    YamlParsingError,
    extractResultAndErrorsFromParsingResult,
} from "../../../..";
import { getYamlMapsFromSequence } from "../yamlSequences/getYamlMapsFromSequence";
import { getMapItems } from "../yamlMaps/getMapItems";
import { getErrorForUnknownKeyInMap } from "../parsingErrors/getErrorForUnknownKeyInMap";
import { stripKeyFromResult } from "../util/stripKeyFromResult";
import { getErrorForMissingKeyInMap } from "../parsingErrors/getErrorForMissingKeyInMap";
import {
    ActionPhase,
    ActionProperty,
    ActionSelectorMethod,
    ActionSelectorProperty,
    ActionType,
    ActionVariableProperty,
    ActionVariableScope,
} from "./constants/actionConstants";
import { getTypedValueFromList } from "../scalars/getTypedValueFromList";

export function parseActionsFromYamlSequence(
    actionsSequence: YAMLSeq,
    commonArgs: CommonParsingArgs,
): ParsingResult<{
    enabled: ParsedAction[];
    disabled: ParsedAction[];
}> {
    const enabledActions: ParsedAction[] = [];
    const disabledActions: ParsedAction[] = [];
    const errors: YamlParsingError[] = [];

    const { items: actionsMaps, errors: sequenceParsingErrors } =
        getYamlMapsFromSequence({
            ...commonArgs,
            sequence: actionsSequence,
        });
    errors.push(...sequenceParsingErrors);

    const keysForStringScalars = [
        ActionProperty.Description,
        ActionProperty.Phase,
        ActionProperty.Type,
    ];
    const keysForBooleanScalars = [ActionProperty.Disabled];
    const keysForMaps = [ActionProperty.Selector, ActionProperty.Variable];

    for (const currentMap of actionsMaps) {
        const {
            items: {
                unknownKeys,
                missingKeys,
                validScalars: {
                    withStringValue: validStringScalars,
                    withBooleanValue: validBooleanScalars,
                },
                validMaps,
            },
            errors: mapItemErrors,
        } = getMapItems(
            currentMap,
            {
                scalars: {
                    stringValues: keysForStringScalars,
                    booleanValues: keysForBooleanScalars,
                },
                mapValues: keysForMaps,
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
                        allowedKeys: Object.values(ActionProperty),
                    }),
                ),
                missingKeys
                    .filter((key) =>
                        (
                            [
                                ActionProperty.Phase,
                                ActionProperty.Selector,
                                ActionProperty.Type,
                                ActionProperty.Variable,
                            ] as string[]
                        ).includes(key),
                    )
                    .map((key) =>
                        getErrorForMissingKeyInMap({
                            ...commonArgs,
                            missingKey: key,
                            map: currentMap,
                        }),
                    ),
            ),
        );
        const maybeAction = parseAction(
            {
                validStringScalars,
                validBooleanScalars,
                validMaps,
            },
            commonArgs,
        );
        const { errors: actionErrors, result: action } =
            extractResultAndErrorsFromParsingResult(maybeAction);
        errors.push(...actionErrors);

        if (!action) {
            continue;
        }

        if (action.disabled.effectiveValue) {
            disabledActions.push(action);
        } else {
            enabledActions.push(action);
        }
    }

    return {
        errors,
        result: { enabled: enabledActions, disabled: disabledActions },
    };
}

function parseAction(
    fields: {
        validStringScalars: WithKeyKeyRangeAndValueRange<string>[];
        validBooleanScalars: WithKeyKeyRangeAndValueRange<boolean>[];
        validMaps: WithKeyAndKeyRange<YAMLMap>[];
    },
    commonArgs: CommonParsingArgs,
): ParsingResult<ParsedAction> {
    const { validBooleanScalars, validMaps, validStringScalars } = fields;
    const errors: YamlParsingError[] = [];

    const maybeUntypedTypeWithKeyRange = validStringScalars.find(
        ({ key }) => key == ActionProperty.Type,
    );
    const maybeType = maybeUntypedTypeWithKeyRange
        ? getTypedValueFromList(
              {
                  allowedValues: Object.values(ActionType),
                  allStringValues: [maybeUntypedTypeWithKeyRange],
                  keyName: ActionProperty.Type,
              },
              errors,
          )
        : undefined;

    const maybeUntypedPhaseWithKeyRange = validStringScalars.find(
        ({ key }) => key == ActionProperty.Phase,
    );
    const maybePhase = maybeUntypedPhaseWithKeyRange
        ? getTypedValueFromList(
              {
                  allowedValues: Object.values(ActionPhase),
                  allStringValues: [maybeUntypedPhaseWithKeyRange],
                  keyName: ActionProperty.Phase,
              },
              errors,
          )
        : undefined;

    const maybeSelectorMap = validMaps.find(
        ({ key }) => key == ActionProperty.Selector,
    );
    const maybeVariableMap = validMaps.find(
        ({ key }) => key == ActionProperty.Variable,
    );

    const maybeDescriptionWithKeyRange = validStringScalars.find(
        ({ key }) => key == ActionProperty.Description,
    );
    const maybeDisabledWithKeyRange = validBooleanScalars.find(
        ({ key }) => key == ActionProperty.Disabled,
    );
    // The default value for 'disabled' is false, when not defined.
    const disabledEffectiveValue =
        maybeDisabledWithKeyRange !== undefined
            ? maybeDisabledWithKeyRange.value
            : false;

    if (!maybeSelectorMap || !maybeVariableMap) {
        return errors;
    }

    const selectorResult = parseSelector(maybeSelectorMap.value, commonArgs);
    const variableResult = parseVariable(maybeVariableMap.value, commonArgs);
    const { result: selectorPureResult, errors: selectorErrors } =
        extractResultAndErrorsFromParsingResult(selectorResult);
    const { result: variablePureResult, errors: variableErrors } =
        extractResultAndErrorsFromParsingResult(variableResult);
    errors.push(...selectorErrors, ...variableErrors);

    if (
        !maybeType ||
        !maybePhase ||
        !selectorPureResult ||
        !variablePureResult
    ) {
        return errors;
    }

    return {
        errors,
        result: {
            phase: maybePhase.value,
            type: maybeType.value,
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
            selector: selectorPureResult,
            variable: variablePureResult,
        },
    };
}

function parseSelector(
    selectorMap: YAMLMap,
    commonArgs: CommonParsingArgs,
): ParsingResult<{
    expression: WithKeyAndValueRange<string>;
    method: WithKeyAndValueRange<ActionSelectorMethod>;
}> {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = Object.values(ActionSelectorProperty);

    const {
        errors: mapItemErrors,
        items: {
            missingKeys,
            unknownKeys,
            validScalars: { withStringValue: validStringScalars },
        },
    } = getMapItems(
        selectorMap,
        { scalars: { stringValues: expectedStringScalars } },
        commonArgs,
    );

    errors.push(
        ...mapItemErrors.concat(
            missingKeys.map((key) =>
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    map: selectorMap,
                    missingKey: key,
                }),
            ),
            unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    allowedKeys: expectedStringScalars,
                    keyRange,
                    unknownKey: key,
                }),
            ),
        ),
    );

    const maybeExpressionWithKeyRange = validStringScalars.find(
        ({ key }) => key == ActionSelectorProperty.Expression,
    );
    const maybeUntypedMethod = validStringScalars.find(
        ({ key }) => key == ActionSelectorProperty.Method,
    );
    const maybeTypedMethod = !maybeUntypedMethod
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(ActionSelectorMethod),
                  allStringValues: [maybeUntypedMethod],
                  keyName: ActionSelectorProperty.Method,
              },
              errors,
          );

    return !maybeExpressionWithKeyRange || !maybeTypedMethod
        ? errors
        : {
              errors,
              result: {
                  expression: stripKeyFromResult(maybeExpressionWithKeyRange),
                  method: maybeTypedMethod.value,
              },
          };
}
function parseVariable(
    variableMap: YAMLMap,
    commonArgs: CommonParsingArgs,
): ParsingResult<{
    name: WithKeyAndValueRange<string>;
    scope: WithKeyAndValueRange<ActionVariableScope>;
}> {
    const errors: YamlParsingError[] = [];
    const expectedStringScalars = Object.values(ActionVariableProperty);

    const {
        errors: mapItemErrors,
        items: {
            missingKeys,
            unknownKeys,
            validScalars: { withStringValue: validStringScalars },
        },
    } = getMapItems(
        variableMap,
        { scalars: { stringValues: expectedStringScalars } },
        commonArgs,
    );

    errors.push(
        ...mapItemErrors.concat(
            missingKeys.map((key) =>
                getErrorForMissingKeyInMap({
                    ...commonArgs,
                    map: variableMap,
                    missingKey: key,
                }),
            ),
            unknownKeys.map(({ key, keyRange }) =>
                getErrorForUnknownKeyInMap({
                    ...commonArgs,
                    allowedKeys: expectedStringScalars,
                    keyRange,
                    unknownKey: key,
                }),
            ),
        ),
    );

    const maybeNameWithKeyRange = validStringScalars.find(
        ({ key }) => key == ActionVariableProperty.Name,
    );
    const maybeUntypedScope = validStringScalars.find(
        ({ key }) => key == ActionVariableProperty.Scope,
    );
    const maybeTypedScope = !maybeUntypedScope
        ? undefined
        : getTypedValueFromList(
              {
                  allowedValues: Object.values(ActionVariableScope),
                  allStringValues: [maybeUntypedScope],
                  keyName: ActionVariableProperty.Scope,
              },
              errors,
          );

    return !maybeNameWithKeyRange || !maybeTypedScope
        ? errors
        : {
              errors,
              result: {
                  name: stripKeyFromResult(maybeNameWithKeyRange),
                  scope: maybeTypedScope.value,
              },
          };
}
