import { Collection, CollectionData, FileChangeType } from "../..";

export type NotificationData<T> = NotificationBaseData<T> &
    (
        | {
              updateType: FileChangeType.Created | FileChangeType.Deleted;
          }
        | {
              updateType: FileChangeType.Modified;
              changedData?: {
                  sequenceChanged: boolean;
                  tagsChanged: boolean;
                  additionalDataChanged: boolean;
              };
          }
    );

interface NotificationBaseData<T> {
    collection: Collection<T>;
    data: CollectionData<T>;
}
