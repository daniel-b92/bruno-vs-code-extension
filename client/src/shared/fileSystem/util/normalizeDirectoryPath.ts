export const normalizeDirectoryPath = (directoryPath: string) => {
    const usesSlashes = directoryPath.includes("/");

    if (usesSlashes) {
        return directoryPath.endsWith("/")
            ? directoryPath
            : `${directoryPath}/`;
    } else {
        return directoryPath.endsWith("\\")
            ? directoryPath
            : `${directoryPath}\\`;
    }
};
