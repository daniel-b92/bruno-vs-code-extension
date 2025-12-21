import { InbuiltFunctionBaseIdentifierEnum } from "../interfaces";

export function getInbuiltFunctionsForEnvironmentVariables() {
    return {
        getEnvironmentVariable: {
            baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
            functionName: "getEnvVar",
        },
        setEnvironmentVariable: {
            baseIdentifier: InbuiltFunctionBaseIdentifierEnum.Bru,
            functionName: "setEnvVar",
        },
    };
}
