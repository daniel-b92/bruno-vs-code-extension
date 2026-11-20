import { AuthTypes } from "../../../..";

export function getAuthTypesForNoDefinedAuthBlock(): string[] {
    return [AuthTypes.None, AuthTypes.Inherit];
}
