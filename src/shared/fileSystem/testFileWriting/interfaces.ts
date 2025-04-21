import { MethodBlockAuth } from "./internal/methodBlockAuthEnum";
import { MethodBlockBody } from "./internal/methodBlockBodyEnum";
import { RequestType } from "../testFileParsing/external/definitions/metaBlock/requestTypeEnum";

export interface MetaBlockContent {
    name: string;
    type: RequestType;
    sequence: number;
}

export interface MethodBlockContent {
    url: string;
    body: MethodBlockBody;
    auth: MethodBlockAuth;
}
