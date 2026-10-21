import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AnnotationContext, AnnotationCommit } from '@iconicedu/shared-types';
import { applyAnnotationCommit } from '@iconicedu/utils';
import type { nativeAnnotationApi } from '@/lib/classroom/annotation-api';
import { NativeScreenAnnotations } from './native-screen-annotations';

/** Development-only native gesture fixture; live authorization remains in apps/api. */
export default function AnnotationFixture() {
  const [active, setActive] = useState(true);
  const { width, height } = useWindowDimensions();
  const api = useMemo<ReturnType<typeof nativeAnnotationApi>>(() => {
    let context: AnnotationContext = {
      actor: { userId: 'fixture-teacher', name: 'Test teacher', role: 'educator' },
      actors: [],
      snapshot: {
        schemaVersion: 1,
        roomId: 'fixture-annotations',
        shareSessionId: 'fixture-share',
        revision: 0,
        studentsEnabled: true,
        ended: false,
        objects: [],
      },
    };
    return {
      load: async () => context,
      pointer: async () => undefined,
      laser: async () => undefined,
      save: async (_room, operation) => {
        const existing = context.snapshot.objects;
        const objects =
          operation.kind === 'put'
            ? [{ ...operation.object, version: operation.baseVersion + 1 }]
            : existing
                .filter((object) =>
                  operation.kind === 'delete'
                    ? object.id === operation.id
                    : operation.kind === 'clear' && !object.deleted,
                )
                .map((object) => ({
                  ...object,
                  deleted: true,
                  version: object.version + 1,
                }));
        const commit: AnnotationCommit = {
          eventId: operation.eventId,
          roomId: context.snapshot.roomId,
          revision: context.snapshot.revision + 1,
          objects,
          ended: false,
          studentsEnabled:
            operation.kind === 'permissions'
              ? operation.enabled
              : context.snapshot.studentsEnabled,
        };
        context = {
          ...context,
          snapshot: applyAnnotationCommit(context.snapshot, commit),
        };
        return commit;
      },
    };
  }, []);
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Text accessibilityRole="header">Native annotation test</Text>
      <View
        style={{
          margin: 16,
          width: width - 32,
          height: height * 0.6,
          backgroundColor: '#ffffff',
        }}
      >
        <NativeScreenAnnotations
          sessionId="fixture"
          shareKey="123"
          width={width - 32}
          height={height * 0.6}
          active={active}
          onToggle={() => setActive((value) => !value)}
          apiOverride={api}
        />
      </View>
    </SafeAreaView>
  );
}
