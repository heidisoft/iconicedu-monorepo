import React from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Image,
  FlatList,
  type ViewProps,
  type TextProps,
  type PressableProps,
  type TextInputProps,
  type ScrollViewProps,
  type ImageProps,
  type FlatListProps,
} from 'react-native';

type WithClassName<P> = P & { className?: string };

export const StyledView = View as React.ComponentType<WithClassName<ViewProps>>;
export const StyledText = Text as React.ComponentType<WithClassName<TextProps>>;
export const StyledPressable = Pressable as React.ComponentType<
  WithClassName<PressableProps>
>;
export const StyledTextInput = TextInput as React.ComponentType<
  WithClassName<TextInputProps>
>;
export const StyledScrollView = ScrollView as React.ComponentType<
  WithClassName<ScrollViewProps>
>;
export const StyledImage = Image as React.ComponentType<
  WithClassName<ImageProps>
>;
export const StyledFlatList = FlatList as React.ComponentType<
  WithClassName<FlatListProps<unknown>>
>;
