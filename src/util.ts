export type Dictionary<V> = { [key: string]: V }

export function min(a: number, b: number): number {
    if(a < b) return a
    return b
}

export function max(a: number, b: number): number {
    if(a > b) return a
    return b
}

export async function sleep(n: number) {
    await new Promise((resolve) => {
        setTimeout(() => resolve(null), n)
    });
}

export function normalizeBit(n: number): number {
    return n > 0.5 ? 1 : 0
}

export type FrameToBitMode = 'first' | 'last' | 'average'

export function frameToBit(frame: Float32Array, mode: FrameToBitMode = 'last'): number {
    if(frame.length != 128) throw new Error("invalid frame")

    if(mode == 'average') {
        var sum = 0
        for(var i = 0; i < frame.length; i++) sum += frame[i]
        return normalizeBit(sum / frame.length)
    }

    const index = mode == 'first' ? 0 : frame.length - 1
    return normalizeBit(frame[index])
}

export function framesToBits(frames: Float32Array[], mode: FrameToBitMode = 'last'): number[] {
    const bits = new Array<number>(frames.length)
    for(var i = 0; i < frames.length; i++) bits[i] = frameToBit(frames[i], mode)
    return bits
}

export function bitToFrame(bit: number, frameSize: number = 128): Float32Array {
    const frame = new Float32Array(frameSize)
    frame.fill(normalizeBit(bit), 0, frameSize - 1)
    return frame
}

export type BitOrder = 'MSBFIRST' | 'LSBFIRST'

export function bitsToNumber(bits: number[], bitorder: BitOrder = 'LSBFIRST'): number {
    var n = 0
    for(var i = 0; i < bits.length; i++) {
        const j = bitorder === 'MSBFIRST' ? (bits.length - 1 - i) : i
        if(bits[j] === 1) {
            n += 2 ** i
        }
    }
    return n
}

export function numberToBits(n: number, bits: number, bitorder: BitOrder = 'LSBFIRST'): number[] {
    assert(n >= 0, 'numberToBits only supports unsigned numbers')
    assert(n < 2**bits, `number (${n}) of range [0,${2**bits})`)
    const result = new Array<number>(bits)
    for(var i = 0; i < bits; i++) {
        const j = bitorder === 'MSBFIRST' ? (bits - 1 - i) : i
        const bit = (n & (1 << j)) != 0
        result[i] = bit ? 1 : 0
    }
    return result
}

export function makeAudioContext(): AudioContext {
    const ctx = new AudioContext()

    const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
    if(ctx.resume) ctx.resume()

    return ctx
}

export function assert(condition: boolean, message?: string) {
    if(!condition) throw new Error(message ? `assertion failed: ${message}` : 'assertion failed')
}