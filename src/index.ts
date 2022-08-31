import { WorkerUrl } from 'worker-url'
import { sleep, frameToBit, framesToBits, bitsToNumber, numberToBits } from './util'

function createBufferGate(ctx: BaseAudioContext): AudioNode {
    const shaper = new WaveShaperNode(ctx, {
        curve: new Float32Array([0, 2])
    })
    return shaper
}

function createNotGate(ctx: BaseAudioContext, input: AudioNode): AudioNode {
    const shaper = new WaveShaperNode(ctx, {
        curve: new Float32Array([2, 0])
    })
    input.connect(shaper)
    return shaper
}

function createOrGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
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

function createNorGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const or = createOrGate(ctx, a, b)
    return createNotGate(ctx, or)
}

function createNandGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const anot = createNotGate(ctx, a)
    const bnot = createNotGate(ctx, b)
    return createOrGate(ctx, anot, bnot)
}

function createAndGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const anot = createNotGate(ctx, a)
    const bnot = createNotGate(ctx, b)
    return createNorGate(ctx, anot, bnot)
}

function createSRNorLatch(ctx: BaseAudioContext, s: AudioNode, r: AudioNode): AudioNode {
    const buf1 = ctx.createGain()
    const buf2 = ctx.createGain()
    const nor1 = createNorGate(ctx, r, buf1)
    nor1.connect(buf2)
    const nor2 = createNorGate(ctx, s, buf2)
    nor2.connect(buf1)
    return nor1
}

function createDLatch(ctx: BaseAudioContext, clk: AudioNode, dat: AudioNode): AudioNode {
    const ndat = createNotGate(ctx, dat)
    const dac = createAndGate(ctx, clk, dat)
    const ndac = createAndGate(ctx, clk, ndat)
    return createSRNorLatch(ctx, dac, ndac)
}

function createDelayLatch(ctx: BaseAudioContext, s: AudioNode, r: AudioNode): AudioNode {
    const delay = ctx.createDelay()
    delay.delayTime.value = 1/44100
    const buf = ctx.createGain()
    buf.connect(delay)
    //s.connect(delay)
    s.connect(buf)
    
    const and = createAndGate(ctx, createNotGate(ctx, r), buf)
    //and.connect(delay)
    and.connect(buf)
    
    return delay
}

function makeSampleBuffer(ctx: BaseAudioContext, data: number[][]): AudioBuffer {
    const buf = ctx.createBuffer(data.length, data[0].length * 128, 44100)
    var last = data[0].length
    for(var channel = 0; channel < data.length; channel++) {
        const cdata = data[channel]
        if(cdata.length != last) throw new Error("invalid data length")
        const chan = buf.getChannelData(channel)
        for(var i = 0; i < cdata.length; i++) {
            const start = i * 128
            const end = (i + 1) * 128
            chan.fill(cdata[i], start, end)
        }
    }
    return buf
}

function makeBufferSource(ctx: BaseAudioContext, buf: AudioBuffer): AudioBufferSourceNode {
    const src = ctx.createBufferSource()
    src.buffer = buf
    return src
}

function makeAudioContext(): AudioContext {
    const ctx = new AudioContext()

    const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start()
    if(ctx.resume) ctx.resume()

    return ctx
}

function createMultiplexor(ctx: BaseAudioContext, y: AudioNode, sel: AudioNode): AudioNode[] {
    const nsel = createNotGate(ctx, sel)
    const o0 = createAndGate(ctx, y, nsel)
    const o1 = createAndGate(ctx, y, sel)
    return [o0, o1]
}

function createDemultiplexor(ctx: BaseAudioContext, a: AudioNode, b: AudioNode, sel: AudioNode) {
    const nsel = createNotGate(ctx, sel)
    const o0 = createAndGate(ctx, a, nsel)
    const o1 = createAndGate(ctx, b, sel)
    return createOrGate(ctx, o0, o1)
}

async function run() {
    const ctx = makeAudioContext()


    await ctx.audioWorklet.addModule(new WorkerUrl(new URL('./recorder-worklet.ts', import.meta.url), { name: 'recorder-processor' }))

    const recorder = new AudioWorkletNode(ctx, 'recorder-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 3,
    })

    var packets: number[][] = []
    recorder.port.onmessage = e => packets.push(framesToBits(e.data[0]))


    const inb = makeBufferSource(ctx, makeSampleBuffer(ctx, [
        [0, 1, 0, 1, 0, 1, 0, 1],
        [0, 0, 1, 1, 0, 0, 1, 1],
        [0, 0, 0, 0, 1, 1, 1, 1]
    ]))

    const splitter = ctx.createChannelSplitter(3)
    inb.connect(splitter)

    const a = ctx.createGain()
    const b = ctx.createGain()
    const sel = ctx.createGain()
    splitter.connect(a, 0)
    splitter.connect(b, 1)
    splitter.connect(sel, 2)

    const d = createDemultiplexor(ctx, a, b, sel)

    d.connect(recorder)

    recorder.port.postMessage(8)
    
    inb.start()
    while(packets.length < 8) {
        await sleep(0)
    }
    inb.stop()

    console.log(packets)

    /*
    const clks = Array.from({ length: 32 }, () => [0, 1]).flat()
    var inb = makeBufferSource(ctx, makeSampleBuffer(ctx, [ clks ]))

    const merger = ctx.createChannelMerger(4)

    const clk = ctx.createGain()
    const dat = ctx.createGain()

    inb.connect(clk)

    const nclk = createNotGate(ctx, clk)
    const latch1 = createDLatch(ctx, nclk, dat)
    const nclk2 = createNotGate(ctx, nclk)
    const latch2 = createDLatch(ctx, nclk2, latch1)
    const ndat = createNotGate(ctx, latch2)
    ndat.connect(dat)
    latch2.connect(merger, 0, 0)

    const dat2 = ctx.createGain()

    const latch3 = createDLatch(ctx, latch2, dat2)
    const nlatch22 = createNotGate(ctx, latch2)
    const latch4 = createDLatch(ctx, nlatch22, latch3)
    const ndat2 = createNotGate(ctx, latch4)
    ndat2.connect(dat2)
    latch4.connect(merger, 0, 1)

    const dat3 = ctx.createGain()

    const latch5 = createDLatch(ctx, latch4, dat3)
    const nlatch42 = createNotGate(ctx, latch4)
    const latch6 = createDLatch(ctx, nlatch42, latch5)
    const ndat3 = createNotGate(ctx, latch6)
    ndat3.connect(dat3)
    latch6.connect(merger, 0, 2)

    const dat4 = ctx.createGain()

    const latch7 = createDLatch(ctx, latch6, dat4)
    const nlatch62 = createNotGate(ctx, latch6)
    const latch8 = createDLatch(ctx, nlatch62, latch7)
    const ndat4 = createNotGate(ctx, latch8)
    ndat4.connect(dat4)
    latch8.connect(merger, 0, 3)

    merger.connect(recorder)

    recorder.port.postMessage(clks.length)

    inb.start()
    while(packets.length < clks.length) {
        await sleep(0)
    }
    inb.stop()

    var last = '0000'
    for(var i = 0; i < packets.length; i++) {
        const packet = packets[i]
        const pstr = `${packet[3]}${packet[2]}${packet[1]}${packet[0]}` // TODO function for this
        if(pstr === last) continue
        last = pstr
        console.log(pstr)
    }
    //console.log(packets)
    */
}



addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button')
    //btn.style.display = 'none'
    btn.innerHTML = 'blah'
    btn.style.fontSize = '48px'
    btn.onclick = run
    document.body.appendChild(btn)
    //btn.click()
})