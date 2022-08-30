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