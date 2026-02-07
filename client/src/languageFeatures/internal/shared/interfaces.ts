import {
    TextDocument,
    Position as VsCodePosition,
    CancellationToken,
} from "vscode";
import { Block, VariableReferenceType } from "@global_shared";
import { OutputChannelLogger, TypedCollection } from "@shared";

export interface LanguageFeatureRequest {
    document: TextDocument;
    position: VsCodePosition;
    token: CancellationToken;
}

export interface EnvVariableRequest {
    requestData: EnvVariableCommonRequestData;
    bruFileSpecificData?: EnvVariableBruFileSpecificData;
    logger?: OutputChannelLogger;
}

export interface EnvVariableCommonRequestData {
    collection: TypedCollection;
    variableName: string;
    functionType: VariableReferenceType;
    requestPosition: VsCodePosition;
    token: CancellationToken;
}

export interface EnvVariableBruFileSpecificData {
    blockContainingPosition: Block;
    allBlocks: Block[];
}
