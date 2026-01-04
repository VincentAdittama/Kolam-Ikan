import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook to refetch stream metadata after entry operations
 * This ensures entry counts remain in sync with the actual database state
 */
export function useStreamRefetch() {
  const queryClient = useQueryClient();

  const refetchStreams = () => {
    queryClient.invalidateQueries({ queryKey: ['streams'] });
  };

  return { refetchStreams };
}
