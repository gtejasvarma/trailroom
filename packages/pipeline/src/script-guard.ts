// The guard every operational script runs first. A script that writes to Firestore or Storage must
// be pointed at the emulators, or at a real project by an explicit flag that NAMES that project.
// Production operations are run by the owner by hand; this makes "by hand" the only way.
type Env = Record<string, string | undefined>;

export type Target =
  | { kind: "emulator"; projectId: string }
  | { kind: "project"; projectId: string };

function configuredProject(env: Env): string | undefined {
  if (env.GOOGLE_CLOUD_PROJECT) return env.GOOGLE_CLOUD_PROJECT;
  if (env.GCLOUD_PROJECT) return env.GCLOUD_PROJECT;
  try {
    const cfg = JSON.parse(env.FIREBASE_CONFIG ?? "{}") as {
      projectId?: string;
    };
    return cfg.projectId;
  } catch {
    return undefined;
  }
}

/**
 * Throws unless the environment is the emulators (BOTH Firestore and Storage hosts set, so no half
 * of a run can reach a real project) or `allowRealProject` equals the configured project id.
 */
export function resolveTarget(env: Env, allowRealProject?: string): Target {
  const fs = Boolean(env.FIRESTORE_EMULATOR_HOST);
  const st = Boolean(env.FIREBASE_STORAGE_EMULATOR_HOST);
  if (fs !== st) {
    throw new Error(
      "refusing to run: only one of FIRESTORE_EMULATOR_HOST and FIREBASE_STORAGE_EMULATOR_HOST is set, so part of this run would reach a real project",
    );
  }
  if (fs && st) {
    return {
      kind: "emulator",
      projectId: configuredProject(env) ?? "demo-trailroom",
    };
  }
  const project = configuredProject(env);
  if (!project) {
    throw new Error(
      "refusing to run: no emulator is configured and no project id is set. Run it under `npm run emulators:exec`, or set GOOGLE_CLOUD_PROJECT and pass --allow-real-project <that project id>",
    );
  }
  if (allowRealProject !== project) {
    throw new Error(
      `refusing to run against the real project "${project}" without --allow-real-project ${project}. This script is for the emulators; production operations are run by hand, deliberately`,
    );
  }
  return { kind: "project", projectId: project };
}
