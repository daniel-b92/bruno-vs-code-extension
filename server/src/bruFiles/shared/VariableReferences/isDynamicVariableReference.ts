import {
    VariableAvailabilityScope,
    VariableAvailabilityScopes,
} from "@global_shared";

export function isDynamicVariableReference(scope?: VariableAvailabilityScope) {
    return (
        !scope ||
        !(
            [
                VariableAvailabilityScopes.PostResponseScriptForOwnItemAndDescendants,
                VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
            ] as VariableAvailabilityScope[]
        ).includes(scope)
    );
}
