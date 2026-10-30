import { extname } from "path";

export function hasEmbeddedCodeBlocks(fileName: string) {
    return isBruFile(fileName) || isYamlFile(fileName);
}

export function isBruFile(fileName: string) {
    return extname(fileName) == ".bru";
}

export function isYamlFile(fileName: string) {
    return [".yml", ".yaml"].includes(extname(fileName));
}

export function isJsFile(fileName: string) {
    return extname(fileName) == ".js";
}
