import { Block, BrunoVariableReference, Logger } from "@global_shared";
import { LanguageFeatureBaseRequest, TypedCollection } from "../../shared";

export interface BlockRequestWithAdditionalData<T extends Block> {
    request: LanguageFeatureBaseRequest;
    file: {
        collection: TypedCollection;
        allBlocks: Block[];
        blockContainingPosition: T;
    };
    logger?: Logger;
}

export interface MatchingDynamicVariables {
    fromSameFile: {
        blockName: string;
        variableReference: BrunoVariableReference;
    }[];
    fromOtherFiles: EquivalentDynamicReferencesFromOtherFiles[];
}

export interface EquivalentDynamicReferencesFromOtherFiles {
    mostRelevantReference: DynamicReferenceFromOtherFile;
    otherMatchingReferences: DynamicReferenceFromOtherFile[];
}

export interface DynamicReferenceFromOtherFile {
    path: {
        absolute: string;
        relativeToSourceFile: string;
    };
    indirectionLevel: number;
    reference: BrunoVariableReference;
}
