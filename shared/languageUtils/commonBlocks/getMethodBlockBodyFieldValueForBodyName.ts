import { getBodyTypeFromBlockName } from "../..";
import { MethodBlockBodies } from "./methodBlocks/methodBlockBodies";
import { RequestFileBlockName } from "../requestFiles/requestFileBlockNameEnum";

export function getMethodBlockBodyFieldValueForBodyName(
    bodyBlockName: RequestFileBlockName,
) {
    const matchingMethodBlockBodyValue = Object.values(MethodBlockBodies).find(
        (methodBlockValue) =>
            methodBlockValue == getBodyTypeFromBlockName(bodyBlockName),
    );

    if (matchingMethodBlockBodyValue) {
        return matchingMethodBlockBodyValue;
    } else if (bodyBlockName == RequestFileBlockName.MultipartFormBody) {
        return MethodBlockBodies.MultipartForm;
    } else if (bodyBlockName == RequestFileBlockName.FormUrlEncodedBody) {
        return MethodBlockBodies.FormUrlEncoded;
    } else if (bodyBlockName == RequestFileBlockName.GraphQlBody) {
        return MethodBlockBodies.GraphQl;
    } else {
        throw new Error(
            `Could not determine a matching value for the body field in the method block for the body block name '${bodyBlockName}'.`,
        );
    }
}
