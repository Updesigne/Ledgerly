import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { JsonStore } from '../src/storage/json-store.js';

describe('JsonStore', () => {
  it('persists and updates JSON values', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'receivables-json-'));
    try {
      const store = new JsonStore(dir);
      await store.write('items.json', [{ id: 1 }]);
      const updated = await store.update<{ id: number }[]>('items.json', [], (items) => [...items, { id: 2 }]);
      expect(updated).toEqual([{ id: 1 }, { id: 2 }]);
      expect(await store.read('items.json', [])).toEqual([{ id: 1 }, { id: 2 }]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('rejects paths outside the data directory', async () => {
    const store = new JsonStore('/tmp/test-store');
    await expect(store.read('../secrets.json', {})).rejects.toThrow('Invalid JSON store filename');
  });
});
