import { cn } from '@iconicedu/ui-native/lib/utils';
import { View } from 'react-native';

function Skeleton({ className, ...props }: React.ComponentProps<typeof View>) {
  return (
    <View className={cn('bg-accent animate-pulse rounded-md', className)} {...props} />
  );
}

export { Skeleton };
