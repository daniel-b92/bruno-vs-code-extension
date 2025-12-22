import {
    InbuiltEnvVariableFunctionName,
    InbuiltFunctionIdentifier,
    EnvVariableFunctionType,
    InbuiltFunctionBaseIdentifierEnum,
} from "../../interfaces";

export function getInbuiltFunctions(): {
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
