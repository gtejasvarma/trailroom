import { isModelKey, MODELS, type ModelKey } from "./models";
import { POSES, type Pose } from "./prompt";

export interface RenderConfig {
  model: ModelKey;
  dailyCapUsd: number;
  /** The day's ceiling for renders nobody asked for (ARRIVALS_DAILY_USD); never above half of dailyCapUsd, so requested try-ons always keep headroom. */
  unrequestedDailyUsd: number;
  aspectRatio: "3:4";
  poses: Pose[];
}

/** A typo like 5000000 should stop the app, not remove the cap. */
export const MAX_DAILY_CAP_USD = 1000;

/** Invalid config throws; nothing silently falls back to a default. */
export function renderConfigFromEnv(
  env: Record<string, string | undefined> = process.env,
): RenderConfig {
  const model = env.RENDER_MODEL ?? "nano-banana-2.1";
  if (!isModelKey(model)) {
    throw new Error(
      `RENDER_MODEL "${model}" is not one of: ${Object.keys(MODELS).join(", ")}`,
    );
  }

  let dailyCapUsd = 5;
  if (env.DAILY_CAP_USD !== undefined) {
    const raw = env.DAILY_CAP_USD.trim();
    dailyCapUsd = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(dailyCapUsd) || dailyCapUsd <= 0) {
      throw new Error(
        `DAILY_CAP_USD "${env.DAILY_CAP_USD}" must be a positive finite number`,
      );
    }
    if (dailyCapUsd > MAX_DAILY_CAP_USD) {
      throw new Error(
        `DAILY_CAP_USD "${env.DAILY_CAP_USD}" is above the sanity bound of $${MAX_DAILY_CAP_USD}; check for a typo`,
      );
    }
  }

  let unrequestedDailyUsd = 1;
  if (env.ARRIVALS_DAILY_USD !== undefined) {
    const raw = env.ARRIVALS_DAILY_USD.trim();
    unrequestedDailyUsd = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(unrequestedDailyUsd) || unrequestedDailyUsd < 0) {
      throw new Error(
        `ARRIVALS_DAILY_USD "${env.ARRIVALS_DAILY_USD}" must be a finite number of zero or more`,
      );
    }
  }
  unrequestedDailyUsd = Math.min(unrequestedDailyUsd, dailyCapUsd / 2);

  const allPoses = Object.keys(POSES) as Pose[];
  let poses = allPoses;
  if (env.RENDER_POSES !== undefined) {
    const parts = env.RENDER_POSES.split(",").map((s) => s.trim());
    const bad = parts.filter((p) => !(allPoses as string[]).includes(p));
    if (
      parts.length === 0 ||
      bad.length > 0 ||
      new Set(parts).size !== parts.length
    ) {
      throw new Error(
        `RENDER_POSES "${env.RENDER_POSES}" must be a comma list of distinct poses from: ${allPoses.join(", ")}`,
      );
    }
    poses = parts as Pose[];
  }

  return { model, dailyCapUsd, unrequestedDailyUsd, aspectRatio: "3:4", poses };
}
