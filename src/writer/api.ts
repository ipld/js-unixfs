export interface Channel<T> {
  readable: ReadableStream<T>
  writer: Writer<T>
}

export interface Deferred<T, X> {
  succeed(value: T): void
  fail(value: X): void
}

export interface Defer<T, X = unknown> extends Deferred<T, X>, PromiseLike<T> {
  readonly promise: Promise<T>
  readonly deferred: Deferred<T, X>
}

export interface Writer<T> {
  readonly desiredSize: number | null
  releaseLock(): void
  ready: Await<void>

  write(data: T): Await<void>

  close(): Await<void>

  abort(reason: Error): Await<void>
}

export type Await<T> = T | PromiseLike<T>
