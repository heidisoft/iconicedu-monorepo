import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { FONT_SIZE, LINE_HEIGHT } from '@/lib/typography';
import { PulseBox } from './pulse-box';

type SkeletonItem =
  | { type: 'separator'; labelWidth: number }
  | {
      type: 'message';
      own: boolean;
      groupStart: boolean;
      bubbleWidth: number;
      lineWidths: number[];
      reactions?: number; // number of reaction pills to show (1 or 2)
      replyCount?: boolean; // show thread reply row
    };

const ITEMS: SkeletonItem[] = [
  // index 0 = bottom of screen (most recent)
  {
    type: 'message',
    own: false,
    groupStart: true,
    bubbleWidth: 234,
    lineWidths: [202, 222, 194, 166],
  },
  { type: 'separator', labelWidth: 52 },
  {
    type: 'message',
    own: true,
    groupStart: true,
    bubbleWidth: 86,
    lineWidths: [52],
    reactions: 1,
  },
  {
    type: 'message',
    own: false,
    groupStart: true,
    bubbleWidth: 226,
    lineWidths: [202, 184, 148],
    reactions: 1,
  },
  {
    type: 'message',
    own: true,
    groupStart: true,
    bubbleWidth: 234,
    lineWidths: [210, 222, 194, 166],
    reactions: 1,
    replyCount: true,
  },
];

function MessageSeparatorSkeleton({ labelWidth }: { labelWidth: number }) {
  return (
    <View style={s.separatorRow} testID="message-skeleton-separator">
      <PulseBox width={88} height={1} radius={1} />
      <PulseBox width={labelWidth} height={LINE_HEIGHT.base} radius={7} />
      <PulseBox width={88} height={1} radius={1} />
    </View>
  );
}

function MessageBubbleSkeleton({
  own,
  groupStart,
  bubbleWidth,
  lineWidths,
  reactions,
  replyCount,
}: Extract<SkeletonItem, { type: 'message' }>) {
  const { colors } = useTheme();

  return (
    <View
      style={[s.row, own && s.rowOwn, groupStart && s.rowGroupStart]}
      testID={own ? 'message-skeleton-row-own' : 'message-skeleton-row-other'}
    >
      <View style={s.avatarSlot}>
        {!own && groupStart ? <PulseBox width={36} height={36} radius={18} /> : null}
      </View>
      <View style={[s.contentCol, own && s.contentColOwn]}>
        {groupStart ? (
          <View style={[s.nameRow, own && s.nameRowOwn]}>
            {own ? (
              <>
                <PulseBox width={28} height={FONT_SIZE.base} radius={5} />
                <PulseBox width={42} height={LINE_HEIGHT.base} radius={6} />
              </>
            ) : (
              <>
                <PulseBox width={88} height={LINE_HEIGHT.base} radius={6} />
                <PulseBox width={36} height={FONT_SIZE.base} radius={5} />
              </>
            )}
          </View>
        ) : null}
        <View
          style={[
            s.bubbleShell,
            { width: bubbleWidth },
            own && s.bubbleShellOwn,
            { backgroundColor: colors.border },
          ]}
        >
          {lineWidths.map((lineWidth, index) => (
            <PulseBox
              key={`${bubbleWidth}-${lineWidth}-${index}`}
              width={lineWidth}
              height={LINE_HEIGHT.md}
            />
          ))}
        </View>
        {reactions ? (
          <View style={[s.reactionsRow, own && s.reactionsRowOwn]}>
            {Array.from({ length: reactions }, (_, i) => (
              <PulseBox key={`reaction-${i}`} width={60} height={28} radius={14} />
            ))}
          </View>
        ) : null}
        {replyCount ? (
          <View style={[s.replyRow, own && s.replyRowOwn]}>
            <PulseBox width={20} height={20} radius={10} />
            <PulseBox width={20} height={20} radius={10} />
            <PulseBox width={72} height={FONT_SIZE.base} radius={5} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function MessageBubblesSkeleton() {
  const { colors } = useTheme();

  return (
    <View
      accessibilityLabel="Loading"
      style={[s.wrap, { backgroundColor: colors.pageBg }]}
      testID="message-bubbles-skeleton"
    >
      {ITEMS.map((item, index) =>
        item.type === 'separator' ? (
          <MessageSeparatorSkeleton
            key={`separator-${index}`}
            labelWidth={item.labelWidth}
          />
        ) : (
          <MessageBubbleSkeleton key={`message-${index}`} {...item} />
        ),
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingVertical: 8,
    flexDirection: 'column-reverse',
  },
  separatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 1,
    gap: 6,
  },
  rowOwn: {
    flexDirection: 'row-reverse',
  },
  rowGroupStart: {
    paddingTop: 8,
  },
  avatarSlot: {
    width: 36,
    flexShrink: 0,
    alignItems: 'center',
  },
  contentCol: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  contentColOwn: {
    alignItems: 'flex-end',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 3,
  },
  nameRowOwn: {
    justifyContent: 'flex-end',
  },
  bubbleShell: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 3,
  },
  bubbleShellOwn: {
    alignItems: 'flex-end',
  },
  reactionsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    alignItems: 'flex-start',
  },
  reactionsRowOwn: {
    justifyContent: 'flex-end',
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  replyRowOwn: {
    justifyContent: 'flex-end',
  },
});
