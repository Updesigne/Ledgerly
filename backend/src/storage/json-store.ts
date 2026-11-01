import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite } from './atomic-write.js';

/** Single-process JSON persistence for the hackathon MVP; not a multi-instance database. */
export class JsonStore {
  private queues = new Map<string, Promise<unknown>>();
  constructor(private readonly root: string) {}

  private resolve(name: string): string {
    if (name.includes('..') || path.isAbsolute(name) || name.includes('/') || name.includes('\\')) {
      throw new Error('Invalid JSON store filename');
    }
    if (!name.endsWith('.json')) throw new Error('Only .json files are supported');
    return path.join(this.root, name);
  }

  async read<T>(name: string, fallback: T): Promise<T> {
    const file = this.resolve(name);
    await mkdir(this.root, { recursive: true });
    try {
      const raw = await readFile(file, 'utf8');
      return JSON.parse(raw) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await this.write(name, fallback);
        return fallback;
      }
      throw new Error(`Unable to read ${name}: ${(error as Error).message}`);
    }
  }

  async write<T>(name: string, value: T): Promise<void> {
    const file = this.resolve(name);
    const previous = this.queues.get(file) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`));
    this.queues.set(file, next);
    try { await next; } finally { if (this.queues.get(file) === next) this.queues.delete(file); }
  }

  async update<T>(name: string, fallback: T, updater: (current: T) => T): Promise<T> {
    const file = this.resolve(name);
    const previous = this.queues.get(file) ?? Promise.resolve();
    let result!: T;
    const next = previous.catch(() => undefined).then(async () => {
      let current: T;
      try { current = JSON.parse(await readFile(file, 'utf8')) as T; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        current = fallback;
      }
      result = updater(current);
      await atomicWrite(file, `${JSON.stringify(result, null, 2)}\n`);
    });
    this.queues.set(file, next);
    try { await next; return result; } finally { if (this.queues.get(file) === next) this.queues.delete(file); }
  }
}
