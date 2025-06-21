import { MethodBlockAuth, MethodBlockBody, RequestType } from "..";

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
