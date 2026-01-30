import { getZeroDB } from '../../lib/server-utils';
import { privateProcedure, router } from '../trpc';
import { z } from 'zod';

const skillsProcedure = privateProcedure.use(async ({ ctx, next }) => {
  const db = await getZeroDB(ctx.sessionUser.id);
  return next({ ctx: { ...ctx, db } });
});

export const skillsRouter = router({
  list: skillsProcedure.query(async ({ ctx }) => {
    const skills = await ctx.db.listAllSkills();
    return { skills };
  }),

  get: skillsProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const skill = await ctx.db.getSkill(input.id);
      return { skill };
    }),

  create: skillsProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        content: z.string().min(1),
        category: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const skill = await ctx.db.createSkill({
        name: input.name,
        description: input.description ?? null,
        content: input.content,
        category: input.category ?? null,
        connectionId: null,
        isEnabled: true,
      });
      return { skill };
    }),

  update: skillsProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        content: z.string().min(1).optional(),
        category: z.string().optional(),
        isEnabled: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const skill = await ctx.db.updateSkill(id, updates);
      return { skill };
    }),

  delete: skillsProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const success = await ctx.db.deleteSkill(input.id);
      return { success };
    }),

  toggle: skillsProcedure
    .input(z.object({ id: z.string(), isEnabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const skill = await ctx.db.updateSkill(input.id, {
        isEnabled: input.isEnabled,
      });
      return { skill };
    }),

  // Skill Reference endpoints
  listReferences: skillsProcedure
    .input(z.object({ skillId: z.string() }))
    .query(async ({ ctx, input }) => {
      const references = await ctx.db.listSkillReferences(input.skillId);
      return { references };
    }),

  getReference: skillsProcedure
    .input(z.object({ skillId: z.string(), referenceName: z.string() }))
    .query(async ({ ctx, input }) => {
      const reference = await ctx.db.getSkillReference(input.skillId, input.referenceName);
      return { reference };
    }),

  addReference: skillsProcedure
    .input(
      z.object({
        skillId: z.string(),
        name: z.string().min(1),
        content: z.string().min(1),
        order: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const reference = await ctx.db.createSkillReference(input.skillId, {
        name: input.name,
        content: input.content,
        order: input.order,
      });
      return { reference };
    }),

  updateReference: skillsProcedure
    .input(
      z.object({
        referenceId: z.string(),
        name: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        order: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { referenceId, ...updates } = input;
      const reference = await ctx.db.updateSkillReference(referenceId, updates);
      return { reference };
    }),

  deleteReference: skillsProcedure
    .input(z.object({ referenceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const success = await ctx.db.deleteSkillReference(input.referenceId);
      return { success };
    }),
});
