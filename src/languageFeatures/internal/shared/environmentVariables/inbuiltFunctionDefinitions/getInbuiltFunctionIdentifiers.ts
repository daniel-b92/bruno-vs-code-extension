import {
    EnvVariableFunctionType,
    InbuiltEnvVariableFunctionName,
} from "../../interfaces";
import { getInbuiltFunctions } from "./getInbuiltFunctions";

export function getInbuiltFunctionIdentifiers(type?: EnvVariableFunctionType) {
    const allFunctions = Object.values(InbuiltEnvVariableFunctionName).map(
        (functionName) => getInbuiltFunctions()[functionName],
    );

    return allFunctions
        .filter(({ type: t }) => (type != undefined ? t == type : true))
        .map(({ identifier }) => identifier);
}
