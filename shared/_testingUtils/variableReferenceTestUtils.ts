import {
    BrunoVariableReference,
    BrunoVariableType,
    VariableAvailabilityScopes,
    VariableReferenceType,
} from "..";
import { getDummyRange } from "./documentTestUtils";

/** Creates a static script variable reference (a write of a folder variable). Use the overrides for other kinds of references. */
export function createVariableReference(
    overrides: Partial<BrunoVariableReference> = {},
): BrunoVariableReference {
    return {
        variableName: "folderVar",
        variableNameRange: getDummyRange(),
        variableType: BrunoVariableType.Folder,
        referenceType: VariableReferenceType.Write,
        scope: VariableAvailabilityScopes.PreRequestScriptForOwnItemAndDescendants,
        ...overrides,
    };
}
