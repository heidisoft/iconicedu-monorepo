import { NativeOnlyAnimatedView } from '@iconicedu/ui-native/components/ui/native-only-animated-view';
import { TextClassContext } from '@iconicedu/ui-native/components/ui/text';
import { cn } from '@iconicedu/ui-native/lib/utils';
import * as TooltipPrimitive from '@rn-primitives/tooltip';
import * as React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { FullWindowOverlay as RNFullWindowOverlay } from 'react-native-screens';

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const FullWindowOverlay = Platform.OS === 'ios' ? RNFullWindowOverlay : React.Fragment;

function TooltipContent({
  className,
  sideOffset = 4,
  portalHost,
  side = 'top',
  style,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
    portalHost?: string;
  }) {
  const contentStyle =
    Platform.OS !== 'web'
      ? ([styles.nativeContent, style].filter(Boolean) as React.ComponentProps<
          typeof TooltipPrimitive.Content
        >['style'])
      : style;

  return (
    <TooltipPrimitive.Portal hostName={portalHost}>
      <FullWindowOverlay>
        <TooltipPrimitive.Overlay style={Platform.select({ native: StyleSheet.absoluteFill })}>
          <NativeOnlyAnimatedView
            entering={
              side === 'top'
                ? FadeInDown.withInitialValues({ transform: [{ translateY: 3 }] }).duration(150)
                : FadeInUp.withInitialValues({ transform: [{ translateY: -5 }] })
            }
            exiting={FadeOut}>
            <TextClassContext.Provider value="text-xs text-primary-foreground">
              <TooltipPrimitive.Content
                sideOffset={sideOffset}
                style={contentStyle}
                className={cn(
                  'bg-primary z-50 rounded-md px-3 py-2 sm:py-1.5',
                  Platform.select({
                    web: cn(
                      'animate-in fade-in-0 zoom-in-95 origin-(--radix-tooltip-content-transform-origin) w-fit text-balance',
                      side === 'bottom' && 'slide-in-from-top-2',
                      side === 'left' && 'slide-in-from-right-2',
                      side === 'right' && 'slide-in-from-left-2',
                      side === 'top' && 'slide-in-from-bottom-2'
                    ),
                  }),
                  className
                )}
                side={side}
                {...props}
              />
            </TextClassContext.Provider>
          </NativeOnlyAnimatedView>
        </TooltipPrimitive.Overlay>
      </FullWindowOverlay>
    </TooltipPrimitive.Portal>
  );
}

const styles = StyleSheet.create({
  nativeContent: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    zIndex: 9999,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});

export { Tooltip, TooltipContent, TooltipTrigger };
