/** Neutral primitives allow asset packs to target any canvas engine. */
export type AssetPrimitive =
  | {
      type: 'line';
      x: number;
      y: number;
      points: [number, number][];
      color?: string;
      width?: number;
    }
  | {
      type: 'rectangle';
      x: number;
      y: number;
      width: number;
      height: number;
      color?: string;
    }
  | { type: 'text'; x: number; y: number; text: string; size?: number };
export interface WhiteboardAsset {
  id: string;
  name: string;
  category: string;
  tags: string[];
  width: number;
  height: number;
  primitives: AssetPrimitive[];
}
export class WhiteboardAssetRegistry {
  private assets = new Map<string, WhiteboardAsset>();
  register(asset: WhiteboardAsset) {
    if (
      !asset.id ||
      !asset.name ||
      !asset.primitives.length ||
      asset.width <= 0 ||
      asset.height <= 0
    )
      throw new Error('Invalid educational asset');
    if (this.assets.has(asset.id)) throw new Error('Asset already registered');
    this.assets.set(asset.id, asset);
  }
  search(query: string, category?: string) {
    const q = query.toLowerCase().trim();
    return [...this.assets.values()].filter(
      (a) =>
        (!category || a.category === category) &&
        `${a.name} ${a.tags.join(' ')}`.toLowerCase().includes(q),
    );
  }
  categories() {
    return [...new Set([...this.assets.values()].map((a) => a.category))];
  }
  get(id: string) {
    const asset = this.assets.get(id);
    if (!asset) throw new Error('Educational asset not found');
    return asset;
  }
}
const grid: AssetPrimitive[] = [];
for (let i = 0; i <= 10; i++) {
  grid.push({
    type: 'line',
    x: i * 30,
    y: 0,
    points: [
      [0, 0],
      [0, 300],
    ],
    color: '#cbd5e1',
  });
  grid.push({
    type: 'line',
    x: 0,
    y: i * 30,
    points: [
      [0, 0],
      [300, 0],
    ],
    color: '#cbd5e1',
  });
}
export const educationalAssets = new WhiteboardAssetRegistry();
educationalAssets.register({
  id: 'math-graph-paper',
  name: 'Graph paper',
  category: 'Math',
  tags: ['grid'],
  width: 300,
  height: 300,
  primitives: grid,
});
educationalAssets.register({
  id: 'math-coordinate-plane',
  name: 'Coordinate plane',
  category: 'Math',
  tags: ['axis', 'graph', 'xy'],
  width: 320,
  height: 320,
  primitives: [
    ...grid,
    {
      type: 'line',
      x: 0,
      y: 150,
      points: [
        [0, 0],
        [300, 0],
      ],
      width: 2,
    },
    {
      type: 'line',
      x: 150,
      y: 0,
      points: [
        [0, 0],
        [0, 300],
      ],
      width: 2,
    },
    { type: 'text', x: 302, y: 140, text: 'x' },
    { type: 'text', x: 158, y: 0, text: 'y' },
  ],
});
const numberLine: AssetPrimitive[] = [
  {
    type: 'line',
    x: 0,
    y: 30,
    points: [
      [0, 0],
      [360, 0],
    ],
    width: 2,
  },
];
for (let i = 0; i <= 10; i++)
  numberLine.push(
    {
      type: 'line',
      x: i * 36,
      y: 24,
      points: [
        [0, 0],
        [0, 12],
      ],
    },
    { type: 'text', x: i * 36 - 4, y: 42, text: String(i - 5), size: 14 },
  );
educationalAssets.register({
  id: 'math-number-line',
  name: 'Number line',
  category: 'Math',
  tags: ['integer', 'counting'],
  width: 360,
  height: 70,
  primitives: numberLine,
});
// Structured chart input demonstrates an extension without changing canvas adapters.
export function createBarChart(
  id: string,
  values: Array<{ label: string; value: number }>,
): WhiteboardAsset {
  if (!values.length || values.some((v) => !Number.isFinite(v.value) || v.value < 0))
    throw new Error('Invalid chart data');
  const max = Math.max(1, ...values.map((v) => v.value));
  return {
    id,
    name: 'Bar chart',
    category: 'Charts',
    tags: ['data'],
    width: values.length * 60,
    height: 240,
    primitives: values.flatMap((v, i) => [
      {
        type: 'rectangle' as const,
        x: i * 60,
        y: 200 - (v.value / max) * 180,
        width: 40,
        height: (v.value / max) * 180,
        color: '#2563eb',
      },
      { type: 'text' as const, x: i * 60, y: 210, text: v.label, size: 14 },
    ]),
  };
}
