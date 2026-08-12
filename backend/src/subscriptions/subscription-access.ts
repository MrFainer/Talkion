import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface SubscriptionAccessSubject {
  status: string;
  next_billing_date: Date | null;
}

export const PAST_DUE_BLOCKED_MESSAGE =
  'Sua assinatura está com pagamento pendente. Regularize para continuar usando o Talkion.';
export const CANCELLED_BLOCKED_MESSAGE =
  'Sua assinatura foi cancelada. Assine um plano para continuar usando o Talkion.';
export const EXPIRED_BLOCKED_MESSAGE =
  'O período pago da sua assinatura expirou. Regularize o pagamento para continuar usando o Talkion.';

/**
 * Aplica a mesma diretriz do guard do frontend:
 * - `past_due`/`cancelled`: liberado somente enquanto `next_billing_date` for futura;
 * - `active`/`pending`/`paused`: bloqueado se `next_billing_date` já passou;
 * - sem assinatura: liberado (trial, controlado por créditos).
 */
export function subscriptionBlockMessage(
  status: string,
  nextBillingDate: Date | null,
  now = new Date(),
): string | null {
  const deadline = nextBillingDate ? nextBillingDate.getTime() : null;
  const deadlineInFuture = deadline !== null && deadline > now.getTime();

  if (status === 'past_due' || status === 'cancelled') {
    if (!deadlineInFuture) {
      return status === 'cancelled'
        ? CANCELLED_BLOCKED_MESSAGE
        : PAST_DUE_BLOCKED_MESSAGE;
    }
    return null;
  }

  if (deadline !== null && deadline <= now.getTime()) {
    return EXPIRED_BLOCKED_MESSAGE;
  }
  return null;
}

export async function assertServiceAllowed(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  if (!userId) {
    throw new ForbiddenException(PAST_DUE_BLOCKED_MESSAGE);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) {
    throw new ForbiddenException(PAST_DUE_BLOCKED_MESSAGE);
  }
  if (user.role === 'ADMIN') return;

  const sub = await prisma.subscription.findFirst({
    where: { user_id: userId, status: { not: 'cancelled' } },
    orderBy: { created_at: 'desc' },
    select: {
      status: true,
      next_billing_date: true,
      plan: { select: { is_free: true } },
    },
  });

  if (sub?.plan?.is_free) return;

  if (!sub) {
    const cancelledSub = await prisma.subscription.findFirst({
      where: { user_id: userId, status: 'cancelled' },
      orderBy: { created_at: 'desc' },
      select: {
        status: true,
        next_billing_date: true,
        plan: { select: { is_free: true } },
      },
    });
    if (cancelledSub?.plan?.is_free) return;
    if (!cancelledSub) return;
    const message = subscriptionBlockMessage(
      cancelledSub.status,
      cancelledSub.next_billing_date,
    );
    if (message) throw new ForbiddenException(message);
    return;
  }

  const message = subscriptionBlockMessage(sub.status, sub.next_billing_date);
  if (message) throw new ForbiddenException(message);
}
