export type WorkerClass = 'regular' | 'on_call'

export function workerClassLabel(workerClass?: string | null): string {
  return workerClass === 'on_call' ? 'On-call' : 'Regular'
}

export function isOnCall(workerClass?: string | null): boolean {
  return workerClass === 'on_call'
}
