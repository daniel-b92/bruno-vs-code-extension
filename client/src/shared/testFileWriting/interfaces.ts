import { RequestType } from "../../../../shared";

export interface MetaBlockContent {
    name: string;
    type: RequestType;
    sequence: number;
}
