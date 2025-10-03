declare module 'libsignal/src/curve' {
export function generateKeyPair(): any
export function calculateAgreement(...args: any[]): any
export function calculateSignature(...args: any[]): any
export function verifySignature(...args: any[]): any
const curve: {
generateKeyPair: typeof generateKeyPair
calculateAgreement: typeof calculateAgreement
calculateSignature: typeof calculateSignature
verifySignature: typeof verifySignature
}
export default curve
}

declare module 'libsignal/src/crypto' {
export const deriveSecrets: any
export const calculateMAC: any
export const encrypt: any
export const decrypt: any
const crypto: any
export default crypto
}

declare module 'lru-cache' {
type LRUCacheOptions<K, V> = {
max?: number
ttl?: number
ttlAutopurge?: boolean
updateAgeOnGet?: boolean
}

export class LRUCache<K = any, V = any> {
constructor(options?: LRUCacheOptions<K, V>)
get(key: K): V | undefined
set(key: K, value: V): this | boolean
delete(key: K): boolean
has(key: K): boolean
}
}

declare module 'p-queue' {
interface PQueueOptions {
concurrency?: number
intervalCap?: number
interval?: number
}

export default class PQueue {
constructor(options?: PQueueOptions)
add<T>(fn: () => PromiseLike<T> | T): Promise<T>
onIdle(): Promise<void>
}
}
