import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/providers/theme-provider';
import { PulseBox } from './pulse-box';

type SkeletonItem =
  | { type: 'separator'; labelWidth: number }
  | {
      type: 'message';
      own: boolean;
      groupStart: boolean;
      bubbleWidth: number;
      lineWidths: number[];
    };

const ITEMS: SkeletonItem[] = [
  { type: 'separator', labelWidth: 64 },
  {
    type: 'message',
    own: false,
    groupStart: true,
    bubbleWidth: 236,
    lineWidths: [190, 128],
  },
  {
    type: 'message',
    own: false,
    groupStart: false,
    bubbleWidth: 184,
    lineWidths: [154],
  },
  {
    type: 'message',
    own: true,
    groupStart: true,
    bubbleWidth: 198,
    lineWidths: [142, 106],
  },
  {
    type: 'message',
    own: true,
    groupStart: false,
    bubbleWidth: 152,
    lineWidths: [118],
  },
  { type: 'separator', labelWidth: 82 },
  {
    type: 'message',
    own: false,
    groupStart: true,
    bubbleWidth: 248,
    lineWidths: [204, 172, 116],
  },
];

function MessageSeparatorSkeleton({ labelWidth }: { labelWidth: number }) {
  return (
    <View style={s.separatorRow} testID="message-skeleton-separator">
      <PulseBox width={88} height={1} radius={1} />
      <PulseBox width={labelWidth} height={14} radius={7} />
      <PulseBox width={88} height={1} radius={1} />
    </View>
  );
}

function MessageBubbleSkeleton({
  own,
  groupStart,
  bubbleWidth,
  lineWidths,
}: Extract<SkeletonItem, { type: 'message' }>) {
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
                <PulseBox width={28} height={11} radius={5} />
                <PulseBox width={42} height={14} radius={6} />
              </>
            ) : (
              <>
                <PulseBox width={88} height={14} radius={6} />
                <PulseBox width={36} height={11} radius={5} />
              </>
            )}
          </View>
        ) : null}
        <View style={[s.bubbleShell, { width: bubbleWidth }, own && s.bubbleShellOwn]}>
          {lineWidths.map((lineWidth, index) => (
            <PulseBox
              key={`${bubbleWidth}-${lineWidth}-${index}`}
              width={lineWidth}
              height={14}
            />
          ))}
        </View>
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
    paddingHorizontal: 12,
    paddingVertical: 3,
    gap: 8,
  },
  rowOwn: {
    flexDirection: 'row-reverse',
  },
  rowGroupStart: {
    paddingTop: 12,
  },
  avatarSlot: {
    width: 36,
    flexShrink: 0,
    alignItems: 'center',
  },
  contentCol: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  contentColOwn: {
    alignItems: 'flex-end',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 2,
  },
  nameRowOwn: {
    justifyContent: 'flex-end',
  },
  bubbleShell: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  bubbleShellOwn: {
    alignItems: 'flex-end',
  },
});
