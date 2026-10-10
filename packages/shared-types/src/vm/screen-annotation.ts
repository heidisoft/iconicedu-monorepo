export type AnnotationTool =
  | 'cursor'
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'vanishingPen'
  | 'line'
  | 'arrow'
  | 'doubleArrow'
  | 'rectangle'
  | 'rectangleFilled'
  | 'rectangleHighlight'
  | 'ellipse'
  | 'ellipseFilled'
  | 'ellipseHighlight'
  | 'diamond'
  | 'text'
  | 'eraser'
  | 'spotlight'
  | 'pointerArrow'
  | 'stampCheck'
  | 'stampX'
  | 'stampStar'
  | 'stampHeart'
  | 'stampQuestion'
  | 'stampArrow';
export type AnnotationPoint = { x: number; y: number; pressure?: number };
export type AnnotationObject = {
  id: string;
  roomId: string;
  shareSessionId: string;
  type: AnnotationTool;
  creatorId: string;
  creatorName: string;
  creatorRole: 'educator' | 'student';
  points: AnnotationPoint[];
  style: {
    color: string;
    width: number;
    opacity: number;
    fontSize: number;
    bold: boolean;
    italic: boolean;
  };
  text?: string;
  rotation: number;
  createdAt: number;
  updatedAt: number;
  version: number;
  deleted?: boolean;
};
export type AnnotationActor = {
  userId: string;
  name: string;
  role: 'educator' | 'student';
};
export type AnnotationSnapshot = {
  schemaVersion: 1;
  roomId: string;
  shareSessionId: string;
  revision: number;
  studentsEnabled: boolean;
  ended: boolean;
  objects: AnnotationObject[];
};
export type AnnotationContext = {
  actor: AnnotationActor;
  actors: AnnotationActor[];
  snapshot: AnnotationSnapshot;
};
export type AnnotationOperation =
  | { eventId: string; kind: 'put'; object: AnnotationObject; baseVersion: number }
  | { eventId: string; kind: 'delete'; id: string; baseVersion: number }
  | { eventId: string; kind: 'clear'; scope: 'mine' | 'students' | 'all' }
  | { eventId: string; kind: 'permissions'; enabled: boolean }
  | { eventId: string; kind: 'end' };
export type AnnotationCommit = {
  requiresSnapshot?: boolean;
  eventId: string;
  roomId: string;
  revision: number;
  objects: AnnotationObject[];
  studentsEnabled: boolean;
  ended: boolean;
};
/** Previews never authorize a permanent mutation. Sender identity comes from its private topic. */
export type AnnotationPreview = {
  eventId: string;
  roomId: string;
  clientId: string;
  userId: string;
  sequence: number;
  timestamp: number;
  annotationId: string;
} & (
  | { kind: 'start'; object: AnnotationObject }
  | { kind: 'points'; points: AnnotationPoint[] }
  | { kind: 'finish' }
  | {
      kind: 'pointer';
      point: AnnotationPoint;
      tool: 'spotlight' | 'pointerArrow';
      color?: string;
    }
  | { kind: 'vanish'; object: AnnotationObject; expiresAt: number }
);
