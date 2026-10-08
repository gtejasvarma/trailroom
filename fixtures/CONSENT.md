# Fixture consent record

Every consented person in `fixtures/people/` has a row here **before** their photo is used.

**Current exception (ADR 0002 amendment):** p01–p05 are retailer product photos, not consented
people. They're recorded by `sourceUrl` in `manifest.json` instead of here, and they're internal
only, for open coding only, and deleted by the end of M1. The generator renders a person only if
they have a `consentDate` or a `sourceUrl`.

**This file is committed to a public repo.** Use fixture IDs only. Never put names, emails or
anything identifying here. Keep the written consents themselves (message, email, signed note)
off-repo, somewhere only you can reach, and point to them by reference.

## What each person is agreeing to

Ask for this in writing (a text or email reply is enough) and keep it:

> I agree that Tejas may use the photo(s) I provide to generate AI images of me wearing clothing,
> using Google's Gemini image models, for internal testing of the Trailroom try-on product. The
> photos and generated images won't be published or shown outside this testing, won't be used to
> train any model, and I can ask for them to be deleted at any time.

## Record

| Fixture ID | Consent date | Where the written consent is kept | Photos | Revoked? |
| ---------- | ------------ | --------------------------------- | ------ | -------- |
| p01        |              |                                   |        |          |
| p02        |              |                                   |        |          |
| p03        |              |                                   |        |          |
| p04        |              |                                   |        |          |
| p05        |              |                                   |        |          |

## How to revoke

1. Delete `fixtures/people/<id>.*` and every file under `runs/*/sheet/` whose name starts with
   `<id>__`.
2. Remove any lines for that ID from exported label files.
3. Mark the row above as revoked, with the date.

Photos go to Google's Gemini API for generation. On the paid tier, Google's terms say API inputs
aren't used to train its models. Confirm that is still true before running, and don't use a
free-tier key for fixture photos.
