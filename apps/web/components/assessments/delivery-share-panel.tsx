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
  Input,
  Label,
} from '@iconicedu/ui-web';
import { Copy, Link2, RefreshCw } from 'lucide-react';

interface Props {
  deliveryId: string;
  accessToken?: string | null;
  publicUrl?: string | null;
  orgId: string;
}

export function DeliverySharePanel({
  deliveryId,
  accessToken: initialToken,
  publicUrl: initialUrl,
  orgId,
}: Props) {
  const [token, setToken] = useState(initialToken);
  const [publicUrl, setPublicUrl] = useState(initialUrl);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const api = createAssessmentApiClient(createSupabaseBrowserClient());
      const result = await api.generateToken(deliveryId, orgId);
      setToken(result.accessToken);
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
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link2 className="h-4 w-4" /> Public Link
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {publicUrl ? (
          <div className="flex gap-2">
            <Input
              value={publicUrl}
              readOnly
              className="flex-1 text-sm font-mono bg-muted"
            />
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? 'Copied!' : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              title="Regenerate token"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Generate a shareable link for anonymous access.
            </p>
            <Button size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating…' : 'Generate link'}
            </Button>
          </div>
        )}
        {token && (
          <p className="text-xs text-muted-foreground">
            Token: <code className="font-mono">{token}</code>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
