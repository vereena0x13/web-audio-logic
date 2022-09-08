import { WorkerUrl } from 'worker-url'
import { Dictionary, min, max, sleep, frameToBit, framesToBits, bitsToNumber, numberToBits, makeAudioContext } from './util'
import { BLIF, parseBLIF } from './blif'

function makeBufferGate(ctx: BaseAudioContext, input?: AudioNode): AudioNode {
    const shaper = new WaveShaperNode(ctx, {
        curve: new Float32Array([0, 2])
    })
    input?.connect(shaper)
    return shaper
}

function makeNotGate(ctx: BaseAudioContext, input: AudioNode): AudioNode {
    const shaper = new WaveShaperNode(ctx, {
        curve: new Float32Array([2, 0])
    })
    input.connect(shaper)
    return shaper
}

function makeOrGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
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

function makeNorGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const or = makeOrGate(ctx, a, b)
    return makeNotGate(ctx, or)
}

function makeNandGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const anot = makeNotGate(ctx, a)
    const bnot = makeNotGate(ctx, b)
    return makeOrGate(ctx, anot, bnot)
}

function makeAndGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const anot = makeNotGate(ctx, a)
    const bnot = makeNotGate(ctx, b)
    return makeNorGate(ctx, anot, bnot)
}

function makeXorGate(ctx: BaseAudioContext, a: AudioNode, b: AudioNode): AudioNode {
    const n = makeNandGate(ctx, a, b);
    const o = makeOrGate(ctx, a, b);
    return makeAndGate(ctx, n, o);
}

function makeSRNorLatch(ctx: BaseAudioContext, s: AudioNode, r: AudioNode): AudioNode {
    const buf1 = ctx.createGain()
    const buf2 = ctx.createGain()
    const nor1 = makeNorGate(ctx, r, buf1)
    nor1.connect(buf2)
    const nor2 = makeNorGate(ctx, s, buf2)
    nor2.connect(buf1)
    return nor1
}

function makeDLatch(ctx: BaseAudioContext, clk: AudioNode, dat: AudioNode): AudioNode {
    const ndat = makeNotGate(ctx, dat)
    const dac = makeAndGate(ctx, clk, dat)
    const ndac = makeAndGate(ctx, clk, ndat)
    return makeSRNorLatch(ctx, dac, ndac)
}

function makeMSDLatch(ctx: BaseAudioContext, clk: AudioNode, dat: AudioNode): AudioNode {
    const nclk = makeNotGate(ctx, clk)
    const latch1 = makeDLatch(ctx, nclk, dat)
    const nclk2 = makeNotGate(ctx, nclk)
    const latch2 = makeDLatch(ctx, nclk2, latch1)
    return latch2
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

function makeMultiplexor(ctx: BaseAudioContext, y: AudioNode, sel: AudioNode): AudioNode[] {
    const nsel = makeNotGate(ctx, sel)
    const o0 = makeAndGate(ctx, y, nsel)
    const o1 = makeAndGate(ctx, y, sel)
    return [o0, o1]
}

function makeDemultiplexor(ctx: BaseAudioContext, a: AudioNode, b: AudioNode, sel: AudioNode) {
    const nsel = makeNotGate(ctx, sel)
    const o0 = makeAndGate(ctx, a, nsel)
    const o1 = makeAndGate(ctx, b, sel)
    return makeOrGate(ctx, o0, o1)
}

async function run() {
    const src = await (await fetch('http://127.0.0.1:8081/blif/counter.blif')).text()
    const blif = parseBLIF(src)
    console.log(blif)

    
    const ctx = makeAudioContext()


    await ctx.audioWorklet.addModule(new WorkerUrl(new URL('./recorder-worklet.ts', import.meta.url), { name: 'recorder-processor' }))

    const recorder = new AudioWorkletNode(ctx, 'recorder-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: blif.outputs.length,
    })

    var packets: number[][] = []
    recorder.port.onmessage = e => packets.push(framesToBits(e.data[0]))


    const isplit = ctx.createChannelSplitter(blif.inputs.length)
    const omerge = ctx.createChannelMerger(blif.outputs.length)
    omerge.connect(recorder)


    const nodes: Dictionary<AudioNode> = {}
    const toConnect: Dictionary<AudioNode> = {}

    function getNode(name: string): AudioNode {
        if(name in nodes) return nodes[name]
        const b = ctx.createGain()
        nodes[name] = b
        toConnect[name] = b
        return b
    }

    function setNode(name: string, node: AudioNode) {
        if(name in nodes) {
            const n = nodes[name]
            if(!(n instanceof GainNode)) throw new Error()
            if(name in toConnect) {
                delete toConnect[name]
            } else {
                throw new Error()
            }
            node.connect(n)
        } else {
            nodes[name] = node
        }
    }

    blif.inputs.forEach((input, i) => {
        const n = ctx.createGain()
        nodes[input] = n
        isplit.connect(n, i)
    })    
    
    blif.cells.forEach((cell, i) => {
        switch(cell.name) {
            case 'AND': {
                const a = getNode(cell.connections['A'])
                const b = getNode(cell.connections['B'])
                const y = makeAndGate(ctx, a, b)
                setNode(cell.connections['Y'], y)
                break
            }
            case 'NOT': {
                const a = getNode(cell.connections['A'])
                const y = makeNotGate(ctx, a)
                setNode(cell.connections['Y'], y)
                break
            }
            case 'NAND': {
                const a = getNode(cell.connections['A'])
                const b = getNode(cell.connections['B'])
                const y = makeNandGate(ctx, a, b)
                setNode(cell.connections['Y'], y)
                break
            }
            case 'XOR': {
                const a = getNode(cell.connections['A'])
                const b = getNode(cell.connections['B'])
                const y = makeXorGate(ctx, a, b)
                setNode(cell.connections['Y'], y)
                break
            }
            case 'DFF': {
                const c = getNode(cell.connections['C'])
                const d = getNode(cell.connections['D'])
                const q = makeMSDLatch(ctx, c, d)
                setNode(cell.connections['Q'], q)
                break
            }
            case 'BUF': {
                const a = getNode(cell.connections['A'])
                const y = makeBufferGate(ctx, a)
                setNode(cell.connections['Y'], y)
                break
            }
            default: {
                console.log(`WARNING: Unknown cell type: '${cell.name}'`)
                break
            }
        }
    })

    blif.outputs.forEach((output, i) => {
        nodes[output].connect(omerge, 0, i)
    })


    for(const [k, v] of Object.entries(toConnect)) console.log(`Unconnected ${k} ${v}`)


    const clks = Array.from({ length: 32 }, () => [0, 1]).flat()
    const rsts = new Array(clks.length).fill(0)
    const inb = makeBufferSource(ctx, makeSampleBuffer(ctx, [
        clks,
        rsts
    ]))
    const npkts = clks.length
    
    //const npkts = 4
    //const inb = makeBufferSource(ctx, makeSampleBuffer(ctx, [
    //    [0, 1, 0, 1],
    //    [0, 0, 1, 1]
    //]))
    
    //const inb = makeBufferSource(ctx, makeSampleBuffer(ctx, [
    //    [0, 1, 0, 0, 1, 0, 0, 1, 0],
    //    [0, 0, 0, 1, 1, 0, 0, 0, 0]
    //]))
    //const npkts = 9

    inb.connect(isplit)

    recorder.port.postMessage(npkts)
    
    inb.start()
    while(packets.length < npkts) {
        await sleep(0)
    }
    inb.stop()

    console.log(packets)



    /*
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
        [0, 1, 0, 1],
        [0, 0, 1, 1]
    ]))

    const splitter = ctx.createChannelSplitter(3)
    inb.connect(splitter)

    const a = ctx.createGain()
    const b = ctx.createGain()
    splitter.connect(a, 0)
    splitter.connect(b, 1)

    const y = makeXorGate(ctx, a, b)

    y.connect(recorder)

    recorder.port.postMessage(4)
    
    inb.start()
    while(packets.length < 4) {
        await sleep(0)
    }
    inb.stop()

    console.log(packets)
    */


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
    btn.innerHTML = 'blåh'
    btn.style.fontSize = '64px'
    btn.onclick = run
    document.body.appendChild(btn)
    //btn.click()
})