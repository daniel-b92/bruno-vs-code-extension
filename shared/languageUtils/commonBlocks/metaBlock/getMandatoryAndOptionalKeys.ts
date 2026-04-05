import { MetaBlockKey } from "../../..";

export function getMetaBlockMandatoryKeys() {
    return [MetaBlockKey.Name, MetaBlockKey.Sequence, MetaBlockKey.Type];
}

export function getMetaBlockOptionalKeys(isRequestFile: boolean) {
    return isRequestFile ? [MetaBlockKey.Tags] : [];
}
