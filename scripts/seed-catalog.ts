// Seeds the garment images into the Storage EMULATOR bucket. Refuses to run against anything
// else: production images are copied by the deployer (see apps/web/apphosting.yaml).
//   npm run emulators:exec -- "npm run seed:catalog"
import { seedCatalogImages } from "@trailroom/pipeline";

if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  console.error(
    "seed:catalog only runs against the Storage emulator: FIREBASE_STORAGE_EMULATOR_HOST is not set.",
  );
  process.exit(1);
}
const paths = await seedCatalogImages();
console.log(`seeded ${paths.length} objects:\n${paths.join("\n")}`);
