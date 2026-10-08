import { describe, expect, it, vi } from "vitest";
import { startWorkflowExecution } from "./workflows";

describe("startWorkflowExecution", () => {
  it("creates an execution with the job id as the only argument", async () => {
    const createExecution = vi.fn().mockResolvedValue([{}]);
    await startWorkflowExecution(
      "job123",
      { createExecution },
      { GOOGLE_CLOUD_PROJECT: "proj-a" },
    );
    expect(createExecution).toHaveBeenCalledWith({
      parent: "projects/proj-a/locations/us-central1/workflows/render-pose-set",
      execution: { argument: JSON.stringify({ jobId: "job123" }) },
    });
  });

  it("honours WORKFLOW_LOCATION and WORKFLOW_NAME", async () => {
    const createExecution = vi.fn().mockResolvedValue([{}]);
    await startWorkflowExecution(
      "j",
      { createExecution },
      {
        GOOGLE_CLOUD_PROJECT: "p",
        WORKFLOW_LOCATION: "europe-west1",
        WORKFLOW_NAME: "other",
      },
    );
    expect(createExecution.mock.calls[0]![0].parent).toBe(
      "projects/p/locations/europe-west1/workflows/other",
    );
  });

  it("throws a clear error without a project, and never calls the client", async () => {
    const createExecution = vi.fn();
    await expect(
      startWorkflowExecution("j", { createExecution }, {}),
    ).rejects.toThrow(/GOOGLE_CLOUD_PROJECT/);
    expect(createExecution).not.toHaveBeenCalled();
  });

  it("propagates client errors (tryon turns them into start_failed)", async () => {
    const createExecution = vi.fn().mockRejectedValue(new Error("denied"));
    await expect(
      startWorkflowExecution(
        "j",
        { createExecution },
        { GOOGLE_CLOUD_PROJECT: "p" },
      ),
    ).rejects.toThrow("denied");
  });
});
