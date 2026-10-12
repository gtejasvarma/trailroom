import { cookies } from "next/headers";
import { Discover } from "../../components/discover";
import { PHOTO_COOKIE } from "../../lib/photo-cookie";

export default async function DiscoverPage() {
  // Decided on the server so a new visitor's first paint is the hero, not a feed the hero then
  // pushes down. The cookie only says "this browser has a photo"; the client corrects it.
  const hasPhoto = (await cookies()).get(PHOTO_COOKIE)?.value === "1";
  return <Discover serverHasPhoto={hasPhoto} />;
}
