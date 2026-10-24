import {
    Position,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionReferenceType,
} from "@global_shared";
import { LanguageFeatureBaseRequest } from "../../shared";

export function getEnvVariableRelatedFunctionForRequest({
    documentHelper,
    position,
}: Pick<LanguageFeatureBaseRequest, "documentHelper" | "position">) {
    const found = getFirstParameterForInbuiltFunctionIfStringLiteral({
        relevantContent: {
            asString: documentHelper.getText(),
            startPosition: new Position(0, 0),
        },
        functionsToSearchFor: getInbuiltFunctionIdentifiers(),
        position,
    });

    return found
        ? {
              ...found,
              type: getInbuiltFunctionReferenceType(found.inbuiltFunction),
          }
        : undefined;
}
