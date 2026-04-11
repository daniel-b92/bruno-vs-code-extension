import { MethodBlockAuthValues } from "./MethodBlockAuthValues";

export function getAuthTypesForNoDefinedAuthBlock(): string[] {
    return [MethodBlockAuthValues.None, MethodBlockAuthValues.Inherit];
}
