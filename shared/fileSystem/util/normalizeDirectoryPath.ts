export const normalizePath = (
    directoryPath: string,
    withTrailingSeparator = true,
) => {
    const usesSlashes = directoryPath.includes("/");

    if (usesSlashes && withTrailingSeparator) {
        return directoryPath.endsWith("/")
            ? directoryPath
            : `${directoryPath}/`;
    }

    // For Windows, some Tools provide the drive letter in upper case, while others provide it in lower case.
    const withNormalizedDrive = /^\w:/.test(directoryPath)
        ? directoryPath
              .substring(0, 1)
              .toUpperCase()
              .concat(directoryPath.substring(1))
        : directoryPath;

    if (!withTrailingSeparator) {
        return withNormalizedDrive;
    }

    return withNormalizedDrive.endsWith("\\")
        ? withNormalizedDrive
        : `${withNormalizedDrive}\\`;
};
