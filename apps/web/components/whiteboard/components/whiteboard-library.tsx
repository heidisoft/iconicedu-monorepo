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
      className="absolute inset-y-0 right-0 z-20 w-64 max-w-full overflow-auto border-l border-border bg-card p-3 shadow-lg"
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
              className="mb-2 w-full justify-start"
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
