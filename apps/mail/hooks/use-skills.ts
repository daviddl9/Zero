import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTRPC } from '@/providers/query-provider';

export interface Skill {
  id: string;
  userId: string;
  connectionId: string | null;
  name: string;
  description: string | null;
  content: string;
  category: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SkillReference {
  id: string;
  skillId: string;
  name: string;
  content: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export function useSkills() {
  const trpc = useTRPC();
  return useQuery(
    trpc.skills.list.queryOptions(void 0, {
      staleTime: 1000 * 60 * 5, // 5 minutes
    }),
  );
}

export function useSkillMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateSkills = () => {
    // Use the tRPC-generated query key for proper cache invalidation
    const queryKey = trpc.skills.list.queryOptions().queryKey;
    queryClient.invalidateQueries({ queryKey });
  };

  const createSkill = useMutation({
    ...trpc.skills.create.mutationOptions(),
    onSuccess: invalidateSkills,
  });

  const updateSkill = useMutation({
    ...trpc.skills.update.mutationOptions(),
    onSuccess: invalidateSkills,
  });

  const deleteSkill = useMutation({
    ...trpc.skills.delete.mutationOptions(),
    onSuccess: invalidateSkills,
  });

  const toggleSkill = useMutation({
    ...trpc.skills.toggle.mutationOptions(),
    onSuccess: invalidateSkills,
  });

  return {
    createSkill,
    updateSkill,
    deleteSkill,
    toggleSkill,
  };
}

export function useSkillReferences(skillId: string | undefined) {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.skills.listReferences.queryOptions(
      { skillId: skillId! },
      {
        staleTime: 1000 * 60 * 5, // 5 minutes
      },
    ),
    enabled: !!skillId,
  });
}

export function useSkillReferenceMutations(skillId: string | undefined) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const invalidateReferences = () => {
    if (skillId) {
      // Use the tRPC-generated query key for proper cache invalidation
      const queryKey = trpc.skills.listReferences.queryOptions({ skillId }).queryKey;
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const addReference = useMutation({
    ...trpc.skills.addReference.mutationOptions(),
    onSuccess: invalidateReferences,
  });

  const updateReference = useMutation({
    ...trpc.skills.updateReference.mutationOptions(),
    onSuccess: invalidateReferences,
  });

  const deleteReference = useMutation({
    ...trpc.skills.deleteReference.mutationOptions(),
    onSuccess: invalidateReferences,
  });

  return {
    addReference,
    updateReference,
    deleteReference,
  };
}
