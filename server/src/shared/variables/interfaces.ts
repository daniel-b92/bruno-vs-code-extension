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

export interface EquivalentVariableReferencesFromOtherFiles {
    mostRelevantReference: VariableReferenceFromOtherFile;
    otherMatchingReferences: VariableReferenceFromOtherFile[];
}

export interface VariableReferenceFromOtherFile {
    path: {
        absolute: string;
        relativeToSourceFile: string;
    };
    indirectionLevel: number;
    reference: BrunoVariableReference;
}
