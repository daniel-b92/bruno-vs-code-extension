import {
    BrunoVariableReference,
    Logger,
    VariableScopeSection,
} from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "..";

export interface VariableSectionRequest {
    request: LanguageFeatureBaseRequest;
    file: {
        collection: TypedCollection;
        allSections: VariableScopeSection[];
        sectionContainingPosition: VariableScopeSection;
    };
    logger?: Logger;
}

export interface MatchingDynamicVariables {
    fromSameFile: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[];
    fromOtherFiles: EquivalentVariableReferencesFromOtherFiles[];
}

export interface EquivalentVariableReferencesFromOtherFiles<
    T extends VariableReferenceFromOtherFile = VariableReferenceFromOtherFile,
> {
    mostRelevantReference: T;
    otherMatchingReferences: T[];
}

export interface StaticScriptVariableReference extends VariableReferenceFromOtherFile {
    /** The name of the section in which the reference is defined (e.g. the Bru block name or the Yaml key path). */
    sectionName: string;
}

export interface VariableReferenceFromOtherFile {
    path: {
        absolute: string;
        relativeToSourceFile: string;
    };
    indirectionLevel: number;
    reference: BrunoVariableReference;
}
