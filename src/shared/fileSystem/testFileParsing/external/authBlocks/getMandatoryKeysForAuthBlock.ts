import { AuthBlockName } from "../definitions/authBlockNameEnum";
import {
    BasicAuthBlockKey,
    BearerAuthBlockKey,
} from "../definitions/authBlocksKeyEnums";

export function getMandatoryKeysForAuthBlock(
    authBlockName: AuthBlockName
): string[] | undefined {
    if (authBlockName == AuthBlockName.BasicAuth) {
        return Object.values(BasicAuthBlockKey);
    } else if (authBlockName == AuthBlockName.BearerAuth) {
        return Object.values(BearerAuthBlockKey);
    }
}
