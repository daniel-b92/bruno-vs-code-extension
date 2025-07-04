import { getBodyTypeFromBlockName } from "../..";
import { MethodBlockBody } from "./methodBlocks/methodBlockBodyEnum";
import { RequestFileBlockName } from "../requestFiles/requestFileBlockNameEnum";

export function getMethodBlockBodyFieldValueForBodyName(
    bodyBlockName: RequestFileBlockName
) {
    const matchingMethodBlockBodyValue = Object.values(MethodBlockBody).find(
        (methodBlockValue) =>
            methodBlockValue == getBodyTypeFromBlockName(bodyBlockName)
    );

    if (matchingMethodBlockBodyValue) {
        return matchingMethodBlockBodyValue as MethodBlockBody;
    } else if (bodyBlockName == RequestFileBlockName.MultipartFormBody) {
        return MethodBlockBody.MultipartForm;
    } else if (bodyBlockName == RequestFileBlockName.FormUrlEncodedBody) {
        return MethodBlockBody.FormUrlEncoded;
    } else if (bodyBlockName == RequestFileBlockName.GraphQlBody) {
        return MethodBlockBody.GraphQl;
    } else {
        throw new Error(
            `Could not determine a matching value for the body field in the method block for the body block name '${bodyBlockName}'.`
        );
    }
}
