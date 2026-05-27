import {
    InbuiltFunctionIdentifier,
    VariableReferenceType,
    InbuiltFunctionBaseIdentifierEnum,
    InbuiltFunctionName,
    BrunoVariableType,
    VariableAvailabilityScope,
    VariableAvailabilityScopes,
} from "../../../..";

export function getInbuiltFunctions(): {
    [identifier in InbuiltFunctionName]: {
        identifier: InbuiltFunctionIdentifier;
        referenceType: VariableReferenceType;
        variableType: BrunoVariableType;
        scope?: VariableAvailabilityScope;
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
            scope: VariableAvailabilityScopes.Global,
        },
        [InbuiltFunctionName.SetGlobalEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.SetGlobalEnvVar,
            },
            referenceType: VariableReferenceType.Write,
            variableType: BrunoVariableType.Global,
            scope: VariableAvailabilityScopes.Global,
        },
        [InbuiltFunctionName.GetEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.GetEnvVar,
            },
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Environment,
            scope: VariableAvailabilityScopes.Collection,
        },
        [InbuiltFunctionName.SetEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.SetEnvVar,
            },
            referenceType: VariableReferenceType.Write,
            variableType: BrunoVariableType.Environment,
            scope: VariableAvailabilityScopes.Collection,
        },
        [InbuiltFunctionName.DeleteEnvVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.DeleteEnvVar,
            },
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Environment,
            scope: VariableAvailabilityScopes.Collection,
        },
        [InbuiltFunctionName.GetVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.GetVar,
            },
            referenceType: VariableReferenceType.Read,
            variableType: BrunoVariableType.Simple,
        },
        [InbuiltFunctionName.SetVar]: {
            identifier: {
                baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
                functionName: InbuiltFunctionName.SetVar,
            },
            referenceType: VariableReferenceType.Write,
            variableType: BrunoVariableType.Simple,
            scope: VariableAvailabilityScopes.Collection,
        },
    };
}
