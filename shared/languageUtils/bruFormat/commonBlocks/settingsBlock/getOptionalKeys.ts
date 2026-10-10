import { RequestType } from "../../../..";
import { SettingsBlockKey } from "./settingsBlockKeyEnum";

/**
 * Returns the keys that are valid for the settings block.
 * If the request type is not known (yet), all keys are returned.
 */
export function getOptionalKeys(requestType?: string) {
    const allKeys = Object.values(SettingsBlockKey);

    if (requestType == RequestType.Ws) {
        return [
            SettingsBlockKey.EncodeUrl,
            SettingsBlockKey.Timeout,
            SettingsBlockKey.KeepAliveInterval,
        ] as string[];
    }

    return (
        requestType != undefined &&
        (Object.values(RequestType) as string[]).includes(requestType)
            ? allKeys.filter((key) => key != SettingsBlockKey.KeepAliveInterval)
            : allKeys
    ) as string[];
}
