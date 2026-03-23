import {
    InbuiltFunctionIdentifier,
    VariableReferenceType,
    InbuiltFunctionBaseIdentifierEnum,
    InbuiltFunctionName,
    BrunoVariableType,
} from "../../../..";

export function getInbuiltFunctions(): {
    [identifier in InbuiltFunctionName]: {
        identifier: InbuiltFunctionIdentifier;
        referenceType: VariableReferenceType;
        variableType: BrunoVariableType;
    };
} {
    return {
        [InbuiltFunctionName.GetGlobalEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.GetGlobalEnvVar,
            },
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Global,
        },
        [InbuiltFunctionName.SetGlobalEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.SetGlobalEnvVar,
            },
            referenceType: VariableReferenceType.Write,
            variableType: BrunoVariableType.Global,
        },
        [InbuiltFunctionName.GetEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.GetEnvVar,
            },
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Environment,
        },
        [InbuiltFunctionName.SetEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.SetEnvVar,
            },
            referenceType: VariableReferenceType.Write,
            variableType: BrunoVariableType.Environment,
        },
        [InbuiltFunctionName.GetVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.GetVar,
            },
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Runtime,
        },
        [InbuiltFunctionName.SetVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.SetVar,
            },
            referenceType: VariableReferenceType.Write,
            variableType: BrunoVariableType.Runtime,
        },
    };
}
