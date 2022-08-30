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

type BitOrder = 'MSBFIRST' | 'LSBFIRST'

export function bitsToNumber(bits: number[], bitorder: BitOrder): number {
    var n = 0
    for(var i = 0; i < bits.length; i++) {
        const j = bitorder === 'MSBFIRST' ? (bits.length - 1 - i) : i
        if(bits[j] == 1) {
            n += 2 ** i
        }
    }
    return n
}

export function numberToBits(n: number, bits: number, bitorder: BitOrder = 'LSBFIRST'): number[] {
    const result = new Array<number>(bits)
    for(var i = 0; i < bits; i++) {
        const j = bitorder === 'MSBFIRST' ? (bits - 1 - i) : i
        const bit = (n & (1 << j)) != 0
        result.push(bit ? 1 : 0)
    }
    return result
}