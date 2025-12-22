import {
    EnvVariableFunctionType,
    InbuiltEnvVariableFunctionName,
    InbuiltFunctionBaseIdentifierEnum,
    InbuiltFunctionIdentifier,
} from "../interfaces";

export function getInbuiltFunctionIdentifiersForEnvVariables(
    type?: EnvVariableFunctionType,
) {
    const allFunctions = Object.values(InbuiltEnvVariableFunctionName).map(
        (functionName) =>
            getInbuiltFunctionsForEnvironmentVariables()[functionName],
    );

    return allFunctions
        .filter(({ type: t }) => (type != undefined ? t == type : true))
        .map(({ identifier }) => identifier);
}

export function getInbuiltFunctionsForEnvironmentVariables(): {
    [identifier in InbuiltEnvVariableFunctionName]: {
        identifier: InbuiltFunctionIdentifier;
        type: EnvVariableFunctionType;
    };
} {
    return {
        [InbuiltEnvVariableFunctionName.GetEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltEnvVariableFunctionName.GetEnvVar,
            },
            type: EnvVariableFunctionType.Read,
        },
        [InbuiltEnvVariableFunctionName.SetEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltEnvVariableFunctionName.SetEnvVar,
            },
            type: EnvVariableFunctionType.ModifyOrDelete,
        },
    };
}
