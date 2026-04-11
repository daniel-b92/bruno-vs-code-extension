import {
    MethodBlockAuthValues,
    MethodBlockBodies,
    RequestType,
} from "@global_shared";

export interface MetaBlockContent {
    name: string;
    type: RequestType;
    sequence: number;
}

export interface MethodBlockContent {
    url: string;
    body: (typeof MethodBlockBodies)[keyof typeof MethodBlockBodies];
    auth: (typeof MethodBlockAuthValues)[keyof typeof MethodBlockAuthValues];
}
