import {
    VariableAvailabilityScope,
    VariableAvailabilityScopes,
} from "@global_shared";

export function isDynamicVariableReference(scope?: VariableAvailabilityScope) {
    return (
        !scope ||
        !(
            [
                VariableAvailabilityScopes.PostResponseScriptForOwnItemAndMaybeDescendants,
                VariableAvailabilityScopes.PreRequestScriptForOwnItemAndMaybeDescendants,
            ] as VariableAvailabilityScope[]
        ).includes(scope)
    );
}
