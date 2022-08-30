import { WorkerUrl } from 'worker-url'

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

async function sleep(n: number) {
    await new Promise((resolve) => {
        setTimeout(() => resolve(null), n)
    });
}

function makeSampleBuffer(ctx: BaseAudioContext, data: number[]): AudioBuffer {
    const buf = ctx.createBuffer(1, data.length * 128, 44100)
    for(var i = 0; i < data.length; i++) {
        const start = i * 128
        const end = (i + 1) * 128
        buf.getChannelData(0).fill(data[i], start, end)
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

async function run() {
    const ctx = makeAudioContext()


    await ctx.audioWorklet.addModule(new WorkerUrl(new URL('./recorder-worklet.ts', import.meta.url), { name: 'recorder-processor' }))

    const run = ctx.createConstantSource()
    run.start()

    const recorder = new AudioWorkletNode(ctx, 'recorder-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
    })

    var packets: Float32Array[] = []
    recorder.port.onmessage = e => packets.push(e.data[0])


    const s = ctx.createGain()
    const r = ctx.createGain()


    var sb = makeBufferSource(ctx, makeSampleBuffer(ctx, [0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]))
    var rb = makeBufferSource(ctx, makeSampleBuffer(ctx, [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0]))
    sb.connect(s)
    rb.connect(r)

    const latch = createSRNorLatch(ctx, s, r)
    latch.connect(recorder)

    recorder.port.postMessage(13)
    
    sb.start()
    rb.start()

    while(packets.length < 13) {
        await sleep(0)
    }
    
    sb.stop()
    rb.stop()

    console.log(packets)


    packets = []
    sb.disconnect()
    rb.disconnect()

    
    sb = makeBufferSource(ctx, makeSampleBuffer(ctx, [0, 0, 1, 0, 0, 0]))
    rb = makeBufferSource(ctx, makeSampleBuffer(ctx, [0, 0, 0, 0, 1, 0]))
    sb.connect(s)
    rb.connect(r)


    recorder.port.postMessage(6)

    sb.start()
    rb.start()

    while(packets.length < 6) {
        await sleep(0)
    }

    sb.stop()
    rb.stop()

    console.log(packets)


    /*
    const in0Node = makeBufferSource(ctx, makeSampleBuffer(ctx, [1, 0, 1, 0]))

    const not = createNotGate(ctx, in0Node)
    not.connect(worklet)

    worklet.port.postMessage(4)

    in0Node.start()

    while(packets.length < 4) {
        await sleep(0)
    }
    in0Node.stop()

    console.log(packets)

    packets = []
    in0Node.disconnect()


    const in1Node = makeBufferSource(ctx, makeSampleBuffer(ctx, [0, 1, 0, 1]))

    in1Node.connect(not)

    worklet.port.postMessage(4)

    in1Node.start()

    while(packets.length < 4) {
        await sleep(0)
    }
    in1Node.stop()

    console.log(packets)
    */
}



addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button')
    //btn.style.display = 'none'
    btn.innerHTML = 'blah'
    btn.onclick = run
    document.body.appendChild(btn)
    //btn.click()
})