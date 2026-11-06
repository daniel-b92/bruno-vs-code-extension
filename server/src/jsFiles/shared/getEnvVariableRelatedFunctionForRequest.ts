import {
    BrunoVariableType,
    Position,
    getFirstParameterForInbuiltFunctionIfStringLiteral,
    getInbuiltFunctionIdentifiers,
    getInbuiltFunctionReferenceType,
    getInbuiltFunctionVariableType,
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
        // Only persistent environment variables are known outside of Bruno files (e.g. no runtime variables).
        functionsToSearchFor: getInbuiltFunctionIdentifiers().filter(
            (identifier) =>
                getInbuiltFunctionVariableType(identifier) ==
                BrunoVariableType.Environment,
        ),
        position,
    });

    return found
        ? {
              ...found,
              type: getInbuiltFunctionReferenceType(found.inbuiltFunction),
          }
        : undefined;
}
