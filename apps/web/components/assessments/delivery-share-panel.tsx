'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@iconicedu/web/lib/supabase/client';
import { createAssessmentApiClient } from '@iconicedu/web/lib/assessments/api';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
} from '@iconicedu/ui-web';
import { Copy, Check, Link2, RefreshCw } from 'lucide-react';

interface Props {
  deliveryId: string;
  accessToken?: string | null;
  publicUrl?: string | null;
  orgId: string;
}

export function DeliverySharePanel({
  deliveryId,
  accessToken: _initialToken,
  publicUrl: initialUrl,
  orgId,
}: Props) {
  const [publicUrl, setPublicUrl] = useState(initialUrl);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const api = createAssessmentApiClient(createSupabaseBrowserClient());
      const result = await api.generateToken(deliveryId, orgId);
      setPublicUrl(result.publicUrl);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm">Public link</CardTitle>
            <CardDescription className="text-xs">
              Share this URL with anyone — no account required.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {publicUrl ? (
          <div className="flex gap-2">
            <Input
              value={publicUrl}
              readOnly
              className="flex-1 text-sm font-mono bg-muted/50 text-muted-foreground"
            />
            <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              title="Regenerate link (invalidates the old one)"
              className="shrink-0 text-muted-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${generating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              No link generated yet. Generate one to allow anonymous access.
            </p>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="shrink-0"
            >
              {generating ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Generating…
                </>
              ) : (
                'Generate link'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
