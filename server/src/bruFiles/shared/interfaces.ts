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

export type MissingBlock =
    | {
          mandatory: boolean;
          name: string;
      }
    | {
          mandatory: boolean;
          mutuallyExclusiveBlocks: string[];
      };
