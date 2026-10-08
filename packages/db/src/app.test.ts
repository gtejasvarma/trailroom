import { describe, expect, it } from "vitest";
import { bucketName, projectId } from "./app";

const hosting = {
  FIREBASE_CONFIG: JSON.stringify({
    projectId: "some-project",
    storageBucket: "some-project.firebasestorage.app",
  }),
};

describe("project and bucket resolution", () => {
  it("reads both from FIREBASE_CONFIG, which is all App Hosting provides", () => {
    expect(projectId(hosting)).toBe("some-project");
    expect(bucketName(hosting)).toBe("some-project.firebasestorage.app");
  });

  it("lets explicit variables win", () => {
    const env = {
      ...hosting,
      GOOGLE_CLOUD_PROJECT: "explicit",
      STORAGE_BUCKET: "explicit-bucket",
    };
    expect(projectId(env)).toBe("explicit");
    expect(bucketName(env)).toBe("explicit-bucket");
  });

  it("refuses a placeholder nobody filled in", () => {
    expect(() =>
      bucketName({ ...hosting, STORAGE_BUCKET: "REPLACE_WITH_DEFAULT_BUCKET" }),
    ).toThrow(/placeholder/);
  });

  it("throws with no project anywhere, and ignores a malformed FIREBASE_CONFIG", () => {
    expect(() => projectId({})).toThrow(/project id/);
    expect(() => projectId({ FIREBASE_CONFIG: "{not json" })).toThrow(
      /project id/,
    );
  });
});
