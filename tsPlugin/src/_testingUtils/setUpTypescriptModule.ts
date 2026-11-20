import * as ts from "typescript/lib/tsserverlibrary";
import { setTypescript } from "../typescriptModule";

// In production, the Typescript server passes its module to the plugin when initializing it.
// Tests that use parts of the plugin without initializing it need to set the module this way.
setTypescript(ts);
