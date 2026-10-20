import { useMutation, useQuery } from "convex/react";

import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

/** Built-in, library and project skills for a project, with their switches. */
export const useProjectSkills = (projectId: Id<"projects"> | undefined) => {
  return useQuery(
    api.skills.listProjectSkills,
    projectId ? { projectId } : "skip",
  );
};

/** The signed-in user's library skills, each with its enabled-project count. */
export const useLibrarySkills = () => useQuery(api.skills.listLibrary);

/** One stored skill with its body, or skipped while `skillId` is unset. */
export const useSkill = (skillId: Id<"skills"> | undefined) => {
  return useQuery(api.skills.get, skillId ? { skillId } : "skip");
};

export const useSetProjectSkillEnabled = () => {
  return useMutation(api.skills.setProjectSkillEnabled).withOptimisticUpdate(
    (localStore, args) => {
      const skills = localStore.getQuery(api.skills.listProjectSkills, {
        projectId: args.projectId,
      });
      if (skills === undefined) return;

      localStore.setQuery(
        api.skills.listProjectSkills,
        { projectId: args.projectId },
        skills.map((skill) =>
          skill.key === args.skillKey
            ? { ...skill, enabled: args.enabled }
            : skill,
        ),
      );
    },
  );
};

export const useCreateSkill = () => useMutation(api.skills.create);

export const useUpdateSkill = () => useMutation(api.skills.update);

export const useRemoveSkill = () => useMutation(api.skills.remove);
