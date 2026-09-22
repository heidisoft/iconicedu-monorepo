import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  AiRefineDraftInput,
  AiRefineDraftResult,
  AiSuggestedRepliesInput,
  AiSuggestedRepliesResult,
  MessageVM,
} from '@iconicedu/shared-types';
import { createSupabaseServiceClient } from '@iconicedu/api/lib/supabase/service';
import {
  apiFeatureFlagKeys,
  evaluateApiBooleanFlag,
} from '@iconicedu/api/lib/flags/posthog-openfeature';
import { completeWithClaude } from '@iconicedu/api/lib/ai/anthropic-client';
import { checkFactPreservation } from '@iconicedu/api/lib/ai/fact-preservation';
import {
  buildRefineSystemPrompt,
  buildRefineUserContent,
  buildSuggestedRepliesSystemPrompt,
  buildSuggestedRepliesUserContent,
} from '@iconicedu/api/lib/ai/prompts';
import { MessagesService } from '@iconicedu/api/modules/messages/messages.service';

/** Profiles that get access to AI-assist tools. Children are excluded from this pilot — see PR notes. */
const ELIGIBLE_PROFILE_KINDS = new Set(['educator', 'guardian', 'staff']);

const MAX_DRAFT_LENGTH = 4_000;
const MAX_CUSTOM_INSTRUCTION_LENGTH = 500;
const MAX_REFINES_PER_DAY = 30;
const MAX_SUGGESTED_REPLIES_PER_DAY = 20;
const SUGGESTED_REPLIES_CONTEXT_MESSAGE_COUNT = 15;
const SUGGESTED_REPLIES_MAX_LINE_LENGTH = 300;
const SUGGESTED_REPLIES_MAX_CONTEXT_LENGTH = 6_000;

const PREVIEW_LABELS: Record<string, string> = {
  image: '[Image]',
  file: '[File]',
  'audio-recording': '[Voice message]',
  'lesson-assignment': '[Assignment]',
  'homework-submission': '[Homework submitted]',
  'progress-update': '[Progress update]',
  'event-reminder': '[Event reminder]',
  'session-summary': '[Session summary]',
  'session-complete': '[Session complete]',
  'session-booking': '[Session booked]',
  'payment-reminder': '[Payment reminder]',
  'feedback-request': '[Feedback request]',
  'design-file-update': '[Design file update]',
  'link-preview': '[Link]',
  'live-session-started': '[Live session started]',
};

function messagePreviewText(message: MessageVM): string {
  if ('content' in message && message.content && 'text' in message.content) {
    const text = message.content.text;
    if (typeof text === 'string' && text.trim()) return text;
  }
  return PREVIEW_LABELS[message.core.type] ?? `[${message.core.type}]`;
}

@Injectable()
export class AiAssistService {
  private readonly logger = new Logger(AiAssistService.name);

  constructor(private readonly messagesService: MessagesService) {}

  private async requireEligibleActor(input: {
    authUserId: string;
    accessToken: string;
    orgId: string;
    profileId: string;
  }) {
    const actor = await this.messagesService.resolveWritableProfile({
      authUserId: input.authUserId,
      accessToken: input.accessToken,
      orgId: input.orgId,
      senderProfileId: input.profileId,
    });
    if (!ELIGIBLE_PROFILE_KINDS.has(actor.profile.kind ?? '')) {
      throw new ForbiddenException('AI assist is not available for this profile');
    }
    return actor;
  }

  /** Server-side rollout gate — mirrors the client-visible flag but is enforced independently of it. */
  private async requireFlagEnabled(
    flagKey: 'enableAiRefine' | 'enableAiSuggestedReplies',
    profileId: string,
  ) {
    const enabled = await evaluateApiBooleanFlag({
      flagKey: apiFeatureFlagKeys[flagKey],
      distinctId: profileId,
    });
    if (!enabled) {
      throw new ForbiddenException('AI assist is not available for this profile');
    }
  }

  /** Simple per-profile daily cap, enforced server-side — a coarse proxy for a real per-org cost budget. */
  private async enforceRateLimit(input: {
    orgId: string;
    profileId: string;
    kind: 'refine' | 'suggested_replies';
    limit: number;
  }) {
    const serviceSupabase = createSupabaseServiceClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await serviceSupabase
      .from('ai_assist_usage')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', input.orgId)
      .eq('profile_id', input.profileId)
      .eq('kind', input.kind)
      .gte('created_at', since);
    if (error) {
      this.logger.warn('ai_assist.rate_limit_check_failed', { error: error.message });
      return; // fail open on the count check itself, not on the AI call
    }
    if ((count ?? 0) >= input.limit) {
      throw new ForbiddenException(
        "You've reached today's AI assist limit for this feature. Please try again tomorrow.",
      );
    }
  }

  private async recordUsage(input: {
    orgId: string;
    profileId: string;
    kind: 'refine' | 'suggested_replies';
  }) {
    const serviceSupabase = createSupabaseServiceClient();
    const { error } = await serviceSupabase.from('ai_assist_usage').insert({
      org_id: input.orgId,
      profile_id: input.profileId,
      kind: input.kind,
    });
    if (error) {
      this.logger.warn('ai_assist.usage_record_failed', { error: error.message });
    }
  }

  async refineDraft(
    authUserId: string,
    accessToken: string,
    input: AiRefineDraftInput,
  ): Promise<AiRefineDraftResult> {
    const content = input.content ?? '';
    if (!content.trim()) throw new BadRequestException('content is required');
    if (content.length > MAX_DRAFT_LENGTH) {
      throw new BadRequestException(
        `content must be ${MAX_DRAFT_LENGTH} characters or fewer`,
      );
    }
    if (input.instruction === 'custom') {
      if (!input.customInstruction?.trim()) {
        throw new BadRequestException(
          'customInstruction is required for the custom instruction',
        );
      }
      if (input.customInstruction.length > MAX_CUSTOM_INSTRUCTION_LENGTH) {
        throw new BadRequestException(
          `customInstruction must be ${MAX_CUSTOM_INSTRUCTION_LENGTH} characters or fewer`,
        );
      }
    }
    if (input.instruction === 'translate' && !input.targetLanguage?.trim()) {
      throw new BadRequestException(
        'targetLanguage is required for the translate instruction',
      );
    }

    const hasSelection =
      typeof input.selectionStart === 'number' &&
      typeof input.selectionEnd === 'number' &&
      input.selectionEnd > input.selectionStart;
    const draftToRefine = hasSelection
      ? content.slice(input.selectionStart, input.selectionEnd)
      : content;
    if (!draftToRefine.trim()) throw new BadRequestException('Nothing to refine');

    await this.requireEligibleActor({
      authUserId,
      accessToken,
      orgId: input.orgId,
      profileId: input.profileId,
    });
    await this.requireFlagEnabled('enableAiRefine', input.profileId);
    // Re-verify the channel is one this profile actually belongs to — the
    // draft never leaves the client otherwise, but the channel context
    // still needs authorization the same as any other message action.
    await this.requireChannelMembership(input.orgId, input.channelId, input.profileId);
    await this.enforceRateLimit({
      orgId: input.orgId,
      profileId: input.profileId,
      kind: 'refine',
      limit: MAX_REFINES_PER_DAY,
    });

    const startedAt = Date.now();
    const refinedText = await completeWithClaude({
      system: buildRefineSystemPrompt(),
      userContent: buildRefineUserContent({
        instruction: input.instruction,
        customInstruction: input.customInstruction,
        targetLanguage: input.targetLanguage,
        draft: draftToRefine,
      }),
      maxTokens: 1024,
    });
    this.logger.log('ai_assist.refine_completed', {
      orgId: input.orgId,
      profileId: input.profileId,
      instruction: input.instruction,
      durationMs: Date.now() - startedAt,
    });
    void this.recordUsage({
      orgId: input.orgId,
      profileId: input.profileId,
      kind: 'refine',
    });

    const { preserved, missing } = checkFactPreservation(draftToRefine, refinedText);
    return {
      refinedText,
      factsPreserved: preserved,
      flaggedNotes: preserved
        ? undefined
        : missing.map(
            (token) => `"${token}" may have been dropped or changed — please check.`,
          ),
    };
  }

  async suggestReplies(
    authUserId: string,
    accessToken: string,
    input: AiSuggestedRepliesInput,
  ): Promise<AiSuggestedRepliesResult> {
    const actor = await this.requireEligibleActor({
      authUserId,
      accessToken,
      orgId: input.orgId,
      profileId: input.profileId,
    });
    await this.requireFlagEnabled('enableAiSuggestedReplies', input.profileId);
    await this.requireChannelMembership(input.orgId, input.channelId, input.profileId);
    await this.enforceRateLimit({
      orgId: input.orgId,
      profileId: input.profileId,
      kind: 'suggested_replies',
      limit: MAX_SUGGESTED_REPLIES_PER_DAY,
    });

    const messages = await this.messagesService.getChannelMessages({
      accessToken,
      orgId: input.orgId,
      channelId: input.channelId,
      profileId: actor.profile.id,
      accountId: actor.accountId,
      limit: SUGGESTED_REPLIES_CONTEXT_MESSAGE_COUNT,
    });
    if (!messages.length) {
      return { suggestions: [] };
    }

    const lines: string[] = [];
    let totalLength = 0;
    for (const message of messages) {
      const senderName = message.core.sender.profile.displayName || 'Someone';
      const text = messagePreviewText(message).slice(
        0,
        SUGGESTED_REPLIES_MAX_LINE_LENGTH,
      );
      const line = `${senderName}: ${text}`;
      if (totalLength + line.length > SUGGESTED_REPLIES_MAX_CONTEXT_LENGTH) break;
      lines.push(line);
      totalLength += line.length;
    }

    const startedAt = Date.now();
    const raw = await completeWithClaude({
      system: buildSuggestedRepliesSystemPrompt(),
      userContent: buildSuggestedRepliesUserContent(lines),
      maxTokens: 512,
    });
    this.logger.log('ai_assist.suggested_replies_completed', {
      orgId: input.orgId,
      profileId: input.profileId,
      contextMessageCount: lines.length,
      durationMs: Date.now() - startedAt,
    });
    void this.recordUsage({
      orgId: input.orgId,
      profileId: input.profileId,
      kind: 'suggested_replies',
    });

    return { suggestions: parseSuggestions(raw) };
  }

  private async requireChannelMembership(
    orgId: string,
    channelId: string,
    profileId: string,
  ) {
    const serviceSupabase = createSupabaseServiceClient();
    const { data, error } = await serviceSupabase
      .from('channel_members')
      .select('id')
      .eq('org_id', orgId)
      .eq('channel_id', channelId)
      .eq('profile_id', profileId)
      .is('deleted_at', null)
      .maybeSingle<{ id: string }>();
    if (error) throw new ForbiddenException('Unable to verify channel access');
    if (!data) throw new ForbiddenException('You are not a member of this channel');
  }
}

function parseSuggestions(raw: string): string[] {
  try {
    // Models occasionally wrap JSON in a fenced code block despite instructions not to.
    const unfenced = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    const parsed = JSON.parse(unfenced);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
      .slice(0, 3);
  } catch {
    return [];
  }
}
