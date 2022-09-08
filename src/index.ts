import { WorkerUrl } from 'worker-url'
import { Dictionary, min, max, sleep, frameToBit, framesToBits, bitsToNumber, numberToBits, makeAudioContext } from './util'
import { BLIF, parseBLIF, blifToDOT } from './blif'
import { makeBufferGate, makeNotGate, makeNandGate, makeAndGate, makeXorGate, makeMSDLatch, makeSampleBuffer, makeBufferSource } from './audio-logic'

async function run() {
    const src = await (await fetch('http://127.0.0.1:8081/blif/counter.blif')).text()
    const blif = parseBLIF(src)
    console.log(blif)
    //console.log(blifToDOT(blif))

    
    const ctx = makeAudioContext()


    await ctx.audioWorklet.addModule(new WorkerUrl(new URL('./recorder-worklet.ts', import.meta.url), { name: 'recorder-processor' }))

    const recorder = new AudioWorkletNode(ctx, 'recorder-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [blif.outputs.length],
        channelCount: blif.outputs.length
    })

    var packet: number[] | null = null
    recorder.port.onmessage = e => packet = framesToBits(e.data[0])


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
            if(!(name in toConnect)) throw new Error()
            delete toConnect[name]
            node.connect(n)
        } else {
            nodes[name] = node
        }
    }

    const inputs: Dictionary<number> = {}
    const outputs: Dictionary<number> = {}

    async function tick(ticks: number = 1) {
        for(var i = 0; i < ticks; i++) {
            const ibuf = blif.inputs.map(input => [inputs[input]])
            const bs = makeBufferSource(ctx, makeSampleBuffer(ctx, ibuf))
            bs.connect(isplit)
            
            packet = null

            recorder.port.postMessage(1)
            bs.start()
            while(packet === null) {
                await sleep(0)
            }
            bs.stop()
            bs.disconnect()

            blif.outputs.forEach((output, j) => outputs[output] = packet![j])
        }
    }

    blif.inputs.forEach((input, i) => {
        const n = ctx.createGain()
        nodes[input] = n
        isplit.connect(n, i)
    })
    
    blif.names.forEach((name, i) => {
        // TODO
    })

    blif.cells.forEach(cell => {
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

    blif.outputs.forEach((output, i) => nodes[output].connect(omerge, 0, i))


    for(const [k, v] of Object.entries(toConnect)) console.log(`Unconnected ${k} ${v}`)


    inputs['clk'] = 0
    inputs['rst'] = 0
    await tick()
    console.log(outputs)


    for(var i = 0; i < 2; i++) {
        // inputs['clk'] = 0
        // inputs['rst'] = 0
        // await tick()
        inputs['clk'] = 1
        inputs['rst'] = 0
        await tick()
        inputs['clk'] = 0
        inputs['rst'] = 0
        await tick()
        console.log(outputs)
    }

    // inputs['clk'] = 0
    // inputs['rst'] = 1
    // await tick()
    inputs['clk'] = 1
    inputs['rst'] = 1
    await tick()
    inputs['clk'] = 0
    inputs['rst'] = 1
    await tick()
    console.log(outputs)
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