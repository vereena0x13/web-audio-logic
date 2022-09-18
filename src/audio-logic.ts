import { assert, Dictionary } from "./util"

export function makeBufferGate(ctx: BaseAudioContext, input?: AudioNode): AudioNode {
    const node = ctx.createGain()
    input?.connect(node)
    return node
}

export function makeNotGate(ctx: BaseAudioContext, input: AudioNode): AudioNode {
    const shaper = new WaveShaperNode(ctx, {
        curve: new Float32Array([2, 0])
    })
    input.connect(shaper)
    return shaper
}

export function makeOrGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const or = ctx.createGain()
    or.gain.value = 2
    a.connect(or)
    b.connect(or)
    const shaper = new WaveShaperNode(ctx, {
        curve: new Float32Array([-1, 1])
    })
    or.connect(shaper)
    return shaper
}

export function makeNorGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const or = makeOrGate(ctx, a, b)
    return makeNotGate(ctx, or)
}

export function makeNandGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const anot = makeNotGate(ctx, a)
    const bnot = makeNotGate(ctx, b)
    return makeOrGate(ctx, anot, bnot)
}

export function makeAndGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const anot = makeNotGate(ctx, a)
    const bnot = makeNotGate(ctx, b)
    return makeNorGate(ctx, anot, bnot)
}

export function makeXorGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const n = makeNandGate(ctx, a, b);
    const o = makeOrGate(ctx, a, b);
    return makeAndGate(ctx, n, o);
}

export function makeSRNorLatch(ctx: BaseAudioContext, s: AudioNode, r: AudioNode): AudioNode {
    const buf1 = ctx.createGain()
    const buf2 = ctx.createGain()
    const nor1 = makeNorGate(ctx, r, buf1)
    nor1.connect(buf2)
    const nor2 = makeNorGate(ctx, s, buf2)
    nor2.connect(buf1)
    return nor1
}

export function makeDLatch(ctx: BaseAudioContext, clk: AudioNode, dat: AudioNode): AudioNode {
    const ndat = makeNotGate(ctx, dat)
    const dac = makeAndGate(ctx, clk, dat)
    const ndac = makeAndGate(ctx, clk, ndat)
    return makeSRNorLatch(ctx, dac, ndac)
}

export function makeMSDLatch(ctx: BaseAudioContext, clk: AudioNode, dat: AudioNode): AudioNode {
    const nclk = makeNotGate(ctx, clk)
    const latch1 = makeDLatch(ctx, clk, dat)
    const latch2 = makeDLatch(ctx, nclk, latch1)
    return latch2
}

export function makeSampleBuffer(ctx: BaseAudioContext, data: number[][]): AudioBuffer {
    const buf = ctx.createBuffer(data.length, data[0].length * 128, 44100)
    var last = data[0].length
    for(var channel = 0; channel < data.length; channel++) {
        const cdata = data[channel]
        assert(cdata.length === last, 'invalid data length')
        const chan = buf.getChannelData(channel)
        for(var i = 0; i < cdata.length; i++) {
            const start = i * 128
            const end = (i + 1) * 128
            chan.fill(cdata[i], start, end)
        }
    }
    return buf
}

export function makeBufferSource(ctx: BaseAudioContext, buf: AudioBuffer): AudioBufferSourceNode {
    const src = ctx.createBufferSource()
    src.buffer = buf
    return src
}

export function makeMultiplexor(ctx: BaseAudioContext, y: AudioNode, sel: AudioNode): AudioNode[] {
    const nsel = makeNotGate(ctx, sel)
    const o0 = makeAndGate(ctx, y, nsel)
    const o1 = makeAndGate(ctx, y, sel)
    return [o0, o1]
}

export function makeDemultiplexor(ctx: BaseAudioContext, a: AudioNode, b: AudioNode, sel: AudioNode) {
    const nsel = makeNotGate(ctx, sel)
    const o0 = makeAndGate(ctx, a, nsel)
    const o1 = makeAndGate(ctx, b, sel)
    return makeOrGate(ctx, o0, o1)
}

export abstract class AudioLogicProcessor {
    abstract update(model: any): boolean;
}