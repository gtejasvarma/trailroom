import { nodeHandler } from "../../../../../server/internal-handlers";

// Route timeout in seconds (Next route segment config). Must be a literal here. The Cloud Run
// request timeout is configured separately (see apps/web/apphosting.yaml).
export const maxDuration = 300;

export const POST = nodeHandler("renderPose");
