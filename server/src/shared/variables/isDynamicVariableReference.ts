import {
    VariableAvailabilityScope,
    VariableAvailabilityScopes,
} from "@global_shared";

export function isDynamicVariableReference(scope?: VariableAvailabilityScope) {
    return (
        !scope ||
        scope !=
            VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants
    );
}
