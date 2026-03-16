'use client';

import { memo } from 'react';
import { CreditCard, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import type { PaymentReminderMessageVM as PaymentReminderMessageType } from '@iconicedu/shared-types';
import {
  MessageBase,
  type MessageBaseProps,
} from '@iconicedu/ui-web/components/messages/message-base';
import { cn } from '@iconicedu/ui-web/lib/utils';

interface PaymentReminderMessageProps extends Omit<
  MessageBaseProps,
  'message' | 'children'
> {
  message: PaymentReminderMessageType;
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  paid: {
    icon: CheckCircle2,
    label: 'Paid',
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
  },
  overdue: {
    icon: AlertCircle,
    label: 'Overdue',
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
  },
};

export const PaymentReminderMessage = memo(function PaymentReminderMessage(
  props: PaymentReminderMessageProps,
) {
  const { message, ...baseProps } = props;
  const { payment } = message;
  const status = statusConfig[payment.status];
  const StatusIcon = status.icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  return (
    <MessageBase message={message} {...baseProps} className="bg-amber-500/5">
      <div className="rounded-xl border border-amber-500/20 bg-card overflow-hidden max-w-sm">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10">
                <CreditCard className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Payment Reminder
                </p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(payment.amount, payment.currency)}
                </p>
              </div>
            </div>
            <Badge variant="outline" className={cn('gap-1', status.color)}>
              <StatusIcon className="h-3 w-3" />
              {status.label}
            </Badge>
          </div>

          {payment.description && (
            <p className="text-sm text-muted-foreground mb-3">{payment.description}</p>
          )}

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Due: {formatDate(payment.dueAt)}
            </span>
            {payment.invoiceId && (
              <span className="text-muted-foreground">#{payment.invoiceId}</span>
            )}
          </div>
        </div>

        {payment.status !== 'paid' && (
          <div className="px-4 py-3 bg-muted/50 border-t border-border">
            <Button size="sm" className="w-full">
              Pay Now
            </Button>
          </div>
        )}
      </div>
    </MessageBase>
  );
});
