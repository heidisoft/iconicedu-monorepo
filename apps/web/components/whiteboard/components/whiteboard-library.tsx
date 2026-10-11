'use client';
import { useState } from 'react';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { educationalAssets, type WhiteboardAsset } from '../assets/registry';
export function WhiteboardLibrary({
  disabled,
  onInsert,
}: {
  disabled: boolean;
  onInsert: (asset: WhiteboardAsset) => void;
}) {
  const [search, setSearch] = useState('');
  return (
    <aside
      aria-label="Educational library"
      data-testid="asset-library"
      className="absolute bottom-3 right-3 top-44 z-30 md:top-20 w-64 max-w-[calc(100%-24px)] overflow-auto rounded-2xl border border-border/60 bg-card p-4 shadow-sm"
    >
      <h3 className="mb-3 font-semibold">Educational library</h3>
      <Input
        aria-label="Search educational assets"
        placeholder="Search assets"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {educationalAssets.categories().map((category) => (
        <section key={category} className="mt-4">
          <h4 className="mb-2 text-sm font-medium">{category}</h4>
          {educationalAssets.search(search, category).map((asset) => (
            <Button
              key={asset.id}
              variant="outline"
              disabled={disabled}
              className="mb-2 min-h-11 w-full justify-start rounded-xl border-border/50 bg-muted/30 font-normal hover:bg-primary/10 hover:text-primary"
              onClick={() => onInsert(asset)}
            >
              {asset.name}
            </Button>
          ))}
        </section>
      ))}
      {!educationalAssets.search(search).length && (
        <p className="mt-4 text-sm text-muted-foreground">No matching assets</p>
      )}
    </aside>
  );
}
