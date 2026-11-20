import { RequestFileBlockName, VariableScopeSectionKind } from "../../../../..";

export function getVariableScopeSectionKindForBlockName(blockName: string) {
    switch (blockName) {
        case RequestFileBlockName.PreRequestScript:
            return VariableScopeSectionKind.PreRequestScript;
        case RequestFileBlockName.PostResponseScript:
            return VariableScopeSectionKind.PostResponseScript;
        case RequestFileBlockName.Tests:
            return VariableScopeSectionKind.Tests;
        case RequestFileBlockName.GrpcBeforeCallStartScript:
            return VariableScopeSectionKind.GrpcBeforeCallStartScript;
        case RequestFileBlockName.GrpcBeforeMessageSendScript:
            return VariableScopeSectionKind.GrpcBeforeMessageSendScript;
        case RequestFileBlockName.GrpcAfterMessageReceiveScript:
            return VariableScopeSectionKind.GrpcAfterMessageReceiveScript;
        case RequestFileBlockName.GrpcAfterCallEndScript:
            return VariableScopeSectionKind.GrpcAfterCallEndScript;
        case RequestFileBlockName.PreRequestVars:
            return VariableScopeSectionKind.PreRequestVars;
        case RequestFileBlockName.PostResponseVars:
            return VariableScopeSectionKind.PostResponseVars;
        case RequestFileBlockName.Assertions:
            return VariableScopeSectionKind.Assertions;
        case RequestFileBlockName.Docs:
        case RequestFileBlockName.Meta:
        case RequestFileBlockName.Settings:
            return VariableScopeSectionKind.NoVariableSupport;
        default:
            return VariableScopeSectionKind.Request;
    }
}
