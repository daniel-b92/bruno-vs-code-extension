import { BrunoTreeItem } from "../../../brunoTreeItem";

export type FileInsertionPosition =
    | RequestFileInsertionPositionType.Folder
    | {
          type: RequestFileInsertionPositionType.AfterFile;
          item: BrunoTreeItem;
      };

export enum RequestFileInsertionPositionType {
    Folder = 1,
    AfterFile = 2,
}
