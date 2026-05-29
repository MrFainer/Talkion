import { Injectable, Logger } from '@nestjs/common';
import { CostAction, CostProvider } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type UsageTrackingContext = {
  teacherId?: string | null;
  studentId?: string | null;
  newsId?: string | null;
  quizId?: string | null;
  whatsappMessageId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  remoteJid?: string | null;
  contentKind?: string | null;
  flowType?: 'OUTGOING' | 'INCOMING' | 'SYSTEM';
  audioSeconds?: number | null;
  metadata?: Record<string, unknown>;
};

type RecordUsageInput = {
  provider: CostProvider;
  action: CostAction;
  modelName?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedInputTokens?: number | null;
  totalTokens?: number | null;
  audioSeconds?: number | null;
  quantity?: number | null;
  unit?: string | null;
  estimatedCostUsd?: number | null;
  tracking?: UsageTrackingContext;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class UsageCostService {
  private readonly logger = new Logger(UsageCostService.name);
  private readonly usdToBrlRate = this.parseNumberEnv('USD_TO_BRL_RATE', 5.5);
  private readonly gpt4oMiniInputPer1MUsd = this.parseNumberEnv(
    'OPENAI_GPT_4O_MINI_INPUT_PER_1M_USD',
    0.15,
  );
  private readonly gpt4oMiniOutputPer1MUsd = this.parseNumberEnv(
    'OPENAI_GPT_4O_MINI_OUTPUT_PER_1M_USD',
    0.6,
  );
  private readonly gpt4oMiniCachedInputPer1MUsd = this.parseNumberEnv(
    'OPENAI_GPT_4O_MINI_CACHED_INPUT_PER_1M_USD',
    0.075,
  );
  private readonly whisperPerMinuteUsd = this.parseNumberEnv(
    'OPENAI_WHISPER_PER_MINUTE_USD',
    0.006,
  );
  private readonly ttsPer1MCharactersUsd = this.parseNumberEnv(
    'OPENAI_TTS_PER_1M_CHARACTERS_USD',
    15,
  );

  constructor(private readonly prisma: PrismaService) {}

  async recordChatCompletion(input: {
    action: CostAction;
    modelName: string;
    response: any;
    tracking?: UsageTrackingContext;
    metadata?: Record<string, unknown>;
  }) {
    const usage = input.response?.usage || {};
    const inputTokens = this.safeInt(usage.prompt_tokens);
    const outputTokens = this.safeInt(usage.completion_tokens);
    const cachedInputTokens = this.safeInt(usage.prompt_tokens_details?.cached_tokens);
    const totalTokens = this.safeInt(usage.total_tokens);
    const billableInputTokens = Math.max(inputTokens - cachedInputTokens, 0);
    const estimatedCostUsd =
      (billableInputTokens / 1_000_000) * this.gpt4oMiniInputPer1MUsd +
      (cachedInputTokens / 1_000_000) * this.gpt4oMiniCachedInputPer1MUsd +
      (outputTokens / 1_000_000) * this.gpt4oMiniOutputPer1MUsd;

    return this.recordUsage({
      provider: CostProvider.OPENAI,
      action: input.action,
      modelName: input.modelName,
      inputTokens,
      outputTokens,
      cachedInputTokens,
      totalTokens,
      estimatedCostUsd,
      tracking: input.tracking,
      metadata: {
        usage,
        ...input.metadata,
      },
    });
  }

  async recordWhisperTranscription(input: {
    tracking?: UsageTrackingContext;
    metadata?: Record<string, unknown>;
  }) {
    const audioSeconds = this.safeFloat(input.tracking?.audioSeconds);
    const estimatedCostUsd = (audioSeconds / 60) * this.whisperPerMinuteUsd;

    return this.recordUsage({
      provider: CostProvider.OPENAI,
      action: CostAction.SPEAKING_TRANSCRIPTION,
      modelName: 'whisper-1',
      audioSeconds,
      quantity: audioSeconds,
      unit: 'seconds',
      estimatedCostUsd,
      tracking: input.tracking,
      metadata: input.metadata,
    });
  }

  async recordTtsUsage(input: {
    tracking?: UsageTrackingContext;
    modelName?: string;
    characters: number;
    metadata?: Record<string, unknown>;
  }) {
    const estimatedCostUsd = (input.characters / 1_000_000) * this.ttsPer1MCharactersUsd;

    return this.recordUsage({
      provider: CostProvider.OPENAI,
      action: CostAction.NEWS_TTS_GENERATION,
      modelName: input.modelName || 'tts-1',
      quantity: input.characters,
      unit: 'characters',
      estimatedCostUsd,
      tracking: input.tracking,
      metadata: input.metadata,
    });
  }

  private async recordUsage(input: RecordUsageInput) {
    try {
      const estimatedCostUsd = this.roundCurrency(input.estimatedCostUsd || 0);
      const estimatedCostBrl = this.roundCurrency(
        estimatedCostUsd * this.usdToBrlRate,
      );

      return await this.prisma.usageCostEvent.create({
        data: {
          teacher_id: input.tracking?.teacherId || null,
          student_id: input.tracking?.studentId || null,
          provider: input.provider,
          action: input.action,
          model_name: input.modelName || null,
          reference_type: input.tracking?.referenceType || null,
          reference_id: input.tracking?.referenceId || null,
          news_id: input.tracking?.newsId || null,
          quiz_id: input.tracking?.quizId || null,
          whatsapp_message_id: input.tracking?.whatsappMessageId || null,
          input_tokens: this.safeNullableInt(input.inputTokens),
          output_tokens: this.safeNullableInt(input.outputTokens),
          cached_input_tokens: this.safeNullableInt(input.cachedInputTokens),
          total_tokens: this.safeNullableInt(input.totalTokens),
          audio_seconds: this.safeNullableFloat(
            input.audioSeconds ?? input.tracking?.audioSeconds,
          ),
          quantity: this.safeNullableFloat(input.quantity),
          unit: input.unit || null,
          estimated_cost_usd: estimatedCostUsd,
          estimated_cost_brl: estimatedCostBrl,
          metadata: {
            remoteJid: input.tracking?.remoteJid || null,
            contentKind: input.tracking?.contentKind || null,
            flowType: input.tracking?.flowType || null,
            ...(input.tracking?.metadata || {}),
            ...(input.metadata || {}),
          },
        },
      });
    } catch (error) {
      this.logger.error(
        'Falha ao registrar evento de custo/uso',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  private parseNumberEnv(name: string, fallback: number) {
    const parsed = Number(process.env[name] || '');
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private safeInt(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return Math.round(parsed);
  }

  private safeFloat(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return this.roundCurrency(parsed);
  }

  private safeNullableInt(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return Math.round(parsed);
  }

  private safeNullableFloat(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }

    return this.roundCurrency(parsed);
  }

  private roundCurrency(value: number) {
    return Number(value.toFixed(6));
  }
}
