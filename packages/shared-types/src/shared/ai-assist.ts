// ─── AI-assisted communication (issue #264, Experimental) ──────────────────
//
// Both capabilities are strictly user-invoked and insert-only: neither can
// send, edit, or delete a message on its own. See apps/api's ai-assist
// module for the actual provider integration, prompt construction, and
// safety controls (data minimization, prompt-injection defenses, rate
// limiting, fact-preservation flagging).

export type AiRefineInstruction =
  | 'proofread'
  | 'clearer'
  | 'shorter'
  | 'warmer'
  | 'professional'
  | 'translate'
  | 'custom';

export type AiRefineDraftInput = {
  orgId: string;
  channelId: string;
  profileId: string;
  /** The full composer draft. */
  content: string;
  /** When set, only this substring of `content` is refined; the rest is left untouched around it. */
  selectionStart?: number;
  selectionEnd?: number;
  instruction: AiRefineInstruction;
  /** Required when instruction is 'custom'. */
  customInstruction?: string;
  /** Required when instruction is 'translate' — a plain-language target, e.g. "Spanish". */
  targetLanguage?: string;
};

export type AiRefineDraftResult = {
  /** The revised text for just the refined span (selection, or the whole draft when there was no selection). */
  refinedText: string;
  /**
   * False when a mention, URL, number, date/time, or amount present in the
   * original text is missing from the refined text — the caller should
   * surface this as a warning rather than silently accepting the rewrite.
   */
  factsPreserved: boolean;
  /** Human-readable notes on what changed/what to double-check, when factsPreserved is false. */
  flaggedNotes?: string[];
};

export type AiSuggestedRepliesInput = {
  orgId: string;
  channelId: string;
  profileId: string;
};

export type AiSuggestedRepliesResult = {
  /** Always 2–3 short, editable suggestions. Never auto-sent. */
  suggestions: string[];
};
