// How an email leaves the building. A transport is one small interface so a real provider is one
// more entry here (a plain fetch call), chosen by EMAIL_TRANSPORT:
//   none  (default) nothing is sent and nothing is recorded as sent. canSend is false, so the
//         product shows no email copy and no email toggles.
//   log   dev and tests only, refused in production like the fake render provider: keeps each
//         message in an in-memory outbox.
type Env = Record<string, string | undefined>;

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  /** Absolute https URL that unsubscribes without signing in (List-Unsubscribe). */
  unsubscribeUrl: string;
}

export interface EmailTransport {
  readonly name: "none" | "log";
  /** False for `none`: callers do nothing at all, and the UI shows nothing about email. */
  readonly canSend: boolean;
  send(message: EmailMessage): Promise<void>;
}

const outbox: EmailMessage[] = [];

/** Tests only: what the `log` transport has "sent". */
export const sentEmails = (): readonly EmailMessage[] => outbox;
export const clearSentEmails = (): void => {
  outbox.length = 0;
};

const none: EmailTransport = {
  name: "none",
  canSend: false,
  async send() {
    throw new Error("EMAIL_TRANSPORT is none: nothing is sent");
  },
};

const log: EmailTransport = {
  name: "log",
  canSend: true,
  async send(message) {
    outbox.push(message);
  },
};

export function emailTransport(env: Env = process.env): EmailTransport {
  const name = (env.EMAIL_TRANSPORT ?? "none").trim().toLowerCase();
  if (name === "none" || name === "") return none;
  if (name === "log") {
    if (
      env.NODE_ENV === "production" ||
      process.env.NODE_ENV === "production"
    ) {
      throw new Error(
        "EMAIL_TRANSPORT=log is for local dev and tests and is refused in production",
      );
    }
    return log;
  }
  throw new Error(
    `EMAIL_TRANSPORT "${env.EMAIL_TRANSPORT}" must be "none" or "log"`,
  );
}

/** The server-reported capability the UI gates on. False for an unknown or refused transport. */
export function emailEnabled(env: Env = process.env): boolean {
  try {
    return emailTransport(env).canSend;
  } catch {
    return false;
  }
}
