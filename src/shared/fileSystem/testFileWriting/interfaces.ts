import { MethodBlockAuth, MethodBlockBody } from "../..";
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
