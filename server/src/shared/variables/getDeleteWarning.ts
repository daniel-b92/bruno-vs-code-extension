import { BrunoVariableType } from "@global_shared";

/** Describes the consequences of deleting a variable of the given type. */
export function getDeleteWarning(variableType: BrunoVariableType) {
    switch (variableType) {
        case BrunoVariableType.Runtime:
            return "Deletes this runtime variable. Later scripts can no longer read it.";
        case BrunoVariableType.Environment:
            return "Deletes this environment variable and persists the change to disk. Later scripts can no longer read it.";
        default:
            return "Deletes this variable. Later scripts can no longer read it.";
    }
}
