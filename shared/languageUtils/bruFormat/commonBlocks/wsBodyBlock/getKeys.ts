import { WsBodyBlockKey } from "./wsBodyBlockKeyEnum";

export function getMandatoryKeysForWsBodyBlock() {
    return [WsBodyBlockKey.Name, WsBodyBlockKey.Type, WsBodyBlockKey.Content];
}

export function getOptionalKeysForWsBodyBlock() {
    return [WsBodyBlockKey.Selected];
}
