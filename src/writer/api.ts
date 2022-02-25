export interface Queue<T> extends ReadableStreamController<T> {
  readonly desiredSize: number

  ready: Promise<void>
}

export interface Channel<T> {
  reader: ReadableStream<T>
  writer: Queue<T>
}

export interface Deferred<T, X> {
  succeed(value: T): void
  fail(value: X): void
}

export interface Defer<T, X = unknown> extends Deferred<T, X>, PromiseLike<T> {
  readonly promise: Promise<T>
  readonly deferred: Deferred<T, X>
}
