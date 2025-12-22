export interface InbuiltFunctionIdentifier {
    baseIdentifier: InbuiltFunctionBaseIdentifierEnum;
    functionName: InbuiltEnvVariableFunctionName;
}

export enum InbuiltFunctionBaseIdentifierEnum {
    Bru = "bru",
    Req = "req",
    Res = "res",
}

export enum InbuiltEnvVariableFunctionName {
    GetEnvVar = "getEnvVar",
    SetEnvVar = "setEnvVar",
}

export enum VariableReferenceType {
    Read = 1,
    ModifyOrDelete = 2,
}
