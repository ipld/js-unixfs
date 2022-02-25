declare export function create(avg:number, min:number, max:number, windowSize:number, polynomial:number):Promise<Rabin>

declare interface Rabin {
  readonly bits: number
  readonly min: number
  readonly max: number
  readonly polynomial: number

  fingerprint(buffer:Uint8Array):number[]
}
