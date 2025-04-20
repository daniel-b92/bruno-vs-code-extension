import { AuthBlockSpecificDiagnosticCode } from "./authBlockSpecificDiagnosticCodeEnum";
import { BodyBlockSpecificDiagnosticCode } from "./bodyBlockSpecificDiagnosticCodeEnum";
import { MetaBlockSpecificDiagnosticCode } from "./metaBlockSpecificDiagnosticCodeEnum";
import { MethodBlockSpecificDiagnosticCode } from "./methodBlockSpecificDiagnosticCodeEnum";
import { NonBlockSpecificDiagnosticCode } from "./nonBlockSpecificDiagnosticCodeEnum";

export type KnownDiagnosticCode =
    | AuthBlockSpecificDiagnosticCode
    | BodyBlockSpecificDiagnosticCode
    | MetaBlockSpecificDiagnosticCode
    | MethodBlockSpecificDiagnosticCode
    | NonBlockSpecificDiagnosticCode;
