import {
    InbuiltEnvVariableFunctionName,
    InbuiltFunctionIdentifier,
    VariableReferenceType,
    InbuiltFunctionBaseIdentifierEnum,
} from "../../../..";

export function getInbuiltFunctions(): {
    [identifier in InbuiltEnvVariableFunctionName]: {
        identifier: InbuiltFunctionIdentifier;
        type: VariableReferenceType;
    };
} {
    return {
        [InbuiltEnvVariableFunctionName.GetEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltEnvVariableFunctionName.GetEnvVar,
            },
            type: VariableReferenceType.Read,
        },
        [InbuiltEnvVariableFunctionName.SetEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltEnvVariableFunctionName.SetEnvVar,
            },
            type: VariableReferenceType.Write,
        },
    };
}
