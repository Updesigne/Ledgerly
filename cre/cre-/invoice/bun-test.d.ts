declare module "bun:test" {
  export interface Matchers<T = unknown> {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeDefined(): void;
    toBeUndefined(): void;
    toBeNull(): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeGreaterThan(expected: number | bigint): void;
    toBeGreaterThanOrEqual(expected: number | bigint): void;
    toBeLessThan(expected: number | bigint): void;
    toBeLessThanOrEqual(expected: number | bigint): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    toBeArray(): void;
    toThrow(expected?: string | RegExp | Error): void;
    not: Matchers<T>;
  }

  export type TestFn = () => void | Promise<void>;

  export interface TestOptions {
    timeout?: number;
    retry?: number;
    repeats?: number;
  }

  export function describe(name: string, fn: () => void): void;
  export namespace describe {
    export function skip(name: string, fn: () => void): void;
    export function only(name: string, fn: () => void): void;
  }

  export function it(name: string, fn: TestFn, options?: TestOptions): void;
  export namespace it {
    export function skip(name: string, fn: TestFn, options?: TestOptions): void;
    export function only(name: string, fn: TestFn, options?: TestOptions): void;
  }

  export function test(name: string, fn: TestFn, options?: TestOptions): void;
  export namespace test {
    export function skip(name: string, fn: TestFn, options?: TestOptions): void;
    export function only(name: string, fn: TestFn, options?: TestOptions): void;
  }

  export function expect<T = unknown>(actual: T): Matchers<T>;

  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;
  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
}

declare namespace Bun {
  export interface Server {
    port: number;
    stop(): void;
  }
  export function serve(options: {
    port?: number | string;
    fetch: (req: Request) => Response | Promise<Response>;
  }): Server;
}


