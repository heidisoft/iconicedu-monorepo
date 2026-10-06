/** Application-owned contracts. Canvas payloads are opaque outside their adapter. */
export type WhiteboardProviderId = 'excalidraw' | 'zoom';
export type WhiteboardRole = 'teacher' | 'student';
export interface WhiteboardElementVM {
  id: string;
  version: number;
  nonce: number;
  deleted: boolean;
  data: Record<string, unknown>;
}
export interface WhiteboardPageVM {
  id: string;
  title: string;
  elements: WhiteboardElementVM[];
}
export interface WhiteboardDocumentVM {
  schemaVersion: 1;
  pages: WhiteboardPageVM[];
  studentEditing: boolean;
  presenting?: boolean;
  /** Retired page IDs prevent delayed add-page messages from resurrecting deleted pages. */
  deletedPageIds?: string[];
}
export interface WhiteboardSnapshotVM {
  id: string;
  revision: number;
  document: WhiteboardDocumentVM;
  role: WhiteboardRole;
  presence: Array<{ id: string; name: string; role: WhiteboardRole }>;
}
export interface WhiteboardAccessVM {
  provider: WhiteboardProviderId;
  /** Short-lived opaque capability, issued only after meeting join authorization. */
  token?: string;
  unavailable?: boolean;
  role?: WhiteboardRole;
}
export type WhiteboardOperationVM =
  | { id: string; type: 'elements'; pageId: string; elements: WhiteboardElementVM[] }
  | { id: string; type: 'add-page'; pageId: string; title: string; sourceId?: string }
  | { id: string; type: 'delete-page'; pageId: string }
  | { id: string; type: 'clear-page'; pageId: string }
  | { id: string; type: 'reorder-page'; pageId: string; beforeId: string | null }
  | { id: string; type: 'student-editing'; enabled: boolean }
  | { id: string; type: 'presentation'; enabled: boolean };
