import { WorkerUrl } from 'worker-url'
import { assert, Dictionary, min, max, sleep, frameToBit, framesToBits, bitsToNumber, numberToBits, makeAudioContext } from './util'
import { BLIF, parseBLIF, blifToDOT, BLIFNames } from './blif'
import { makeBufferGate, makeNotGate, makeNandGate, makeAndGate, makeOrGate, makeNorGate, makeXorGate, makeDLatch, makeMSDLatch, makeSampleBuffer, makeBufferSource } from './audio-logic'


class Bus {
    constructor(
        readonly name: string,
        readonly size: number
    ) {}
}

function computeBuses(xs: string[]): Bus[] {
    const sizes: Dictionary<number> = {}
    xs.forEach(x => {
        if(x.includes('[')) {
            const name = x.substring(0, x.indexOf('['))
            if(!(name in sizes)) sizes[name] = 0
            sizes[name]++
        } else {
            sizes[x] = 1
        }
    })
    const buses: Bus[] = []
    xs.forEach(x => {
        var name = x
        if(x.includes('[')) {
            name = x.substring(0, x.indexOf('['))
            if(buses.length > 0 && name === buses[buses.length-1].name) return
        }
        buses.push(new Bus(name, sizes[name]))
    })
    return buses
}


async function run() {
    const src = await (await fetch('http://127.0.0.1:8081/blif/subleq.blif')).text()
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

    //var packet: number[] | null = null
    //recorder.port.onmessage = e => packet = framesToBits(e.data[0])
    var resolvePacket: (pkt: number[]) => void
    recorder.port.onmessage = e => resolvePacket(framesToBits(e.data[0]))

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
            assert(n instanceof GainNode)
            assert(name in toConnect)
            delete toConnect[name]
            node.connect(n)
        } else {
            nodes[name] = node
        }
    }

    const inputBuses = computeBuses(blif.inputs)
    const outputBuses = computeBuses(blif.outputs)

    const inputs: Dictionary<number> = {}
    const outputs: Dictionary<number> = {}
    inputBuses.forEach(x => inputs[x.name] = 0)
    outputBuses.forEach(x => outputs[x.name] = 0)


    async function tick(ticks: number = 1) {
        for(var i = 0; i < ticks; i++) {
            const ibuf: number[][] = []
            for(const bus of inputBuses) {
                if(bus.size === 1) {
                    ibuf.push([inputs[bus.name]])
                } else {
                    const bits = numberToBits(inputs[bus.name], bus.size)
                    for(const bit of bits) ibuf.push([bit])
                }
            }

            const bs = makeBufferSource(ctx, makeSampleBuffer(ctx, ibuf))
            bs.connect(isplit)

            const pkt = await new Promise<number[]>(resolve => {
                resolvePacket = packet => {
                    bs.stop()
                    bs.disconnect()
                    resolve(packet)
                }
                recorder.port.postMessage(1)
                bs.start()
            });

            var j = 0
            for(const bus of outputBuses) {
                if(bus.size === 1) {
                    outputs[bus.name] = pkt[j]
                } else {
                    outputs[bus.name] = bitsToNumber(pkt.slice(j, j + bus.size))
                }
                j += bus.size
            }
        }
    }

    blif.inputs.forEach((input, i) => {
        const n = ctx.createGain()
        nodes[input] = n
        isplit.connect(n, i)
    })

    function makePLA(names: BLIFNames): AudioNode {
        // TODO: handle special cases: zero cover; one cover that is just a 1 (i.e. a constant 0 or 1); also
        //       handle the case when the PLA is just implementing a buffer gate
        const is = names.inputs.map(input => getNode(input))
        const rows = names.cover.map((covers, i) => {
            const coverParts = covers.split(' ')
            assert(coverParts.length === 2)
            const cover = coverParts[0]
            assert(coverParts[1] === '1')
            assert(cover.length === is.length)
            const rowInputs: AudioNode[] = []
            for(var j = 0; j < cover.length; j++) {
                const c = cover.charAt(j)
                switch(c) {
                    case '1': {
                        rowInputs.push(getNode(names.inputs[i]))
                        break
                    }
                    case '0': {
                        rowInputs.push(makeNotGate(ctx, getNode(names.inputs[i])))
                        break
                    }
                    case '-': {
                        break
                    }
                    default: {
                        throw new Error(`invalid cover character '${c}'`)
                    }
                }
            }
            var row = makeAndGate(ctx, rowInputs[0], rowInputs[1])
            for(var j = 0; j < rowInputs.length; j++) {
                row = makeAndGate(ctx, row, rowInputs[j])
            }
            return row
        })
        var out = makeOrGate(ctx, rows[0], rows[1])
        for(var i = 2; i < rows.length; i++) {
            out = makeOrGate(ctx, out, rows[i])
        }
        return out
    }
    
    blif.names.forEach((name, i) => {
        // TODO
        // setNode(name.output, makePLA(name))
    })

    blif.cells.forEach(cell => {
        switch(cell.name) {
            case 'BUF': {
                const a = getNode(cell.connections['A'])
                const y = makeBufferGate(ctx, a)
                setNode(cell.connections['Y'], y)
                break
            }
            case 'NOT': {
                const a = getNode(cell.connections['A'])
                const y = makeNotGate(ctx, a)
                setNode(cell.connections['Y'], y)
                break
            }
            case 'AND': {
                const a = getNode(cell.connections['A'])
                const b = getNode(cell.connections['B'])
                const y = makeAndGate(ctx, a, b)
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
            case 'OR': {
                const a = getNode(cell.connections['A'])
                const b = getNode(cell.connections['B'])
                const y = makeOrGate(ctx, a, b)
                setNode(cell.connections['Y'], y)
                break
            }
            case 'NOR': {
                const a = getNode(cell.connections['A'])
                const b = getNode(cell.connections['B'])
                const y = makeNorGate(ctx, a, b)
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
            default: {
                console.log(`WARNING: Unknown cell type: '${cell.name}'`)
                break
            }
        }
    })

    blif.outputs.forEach((output, i) => nodes[output].connect(omerge, 0, i))


    for(const [k, v] of Object.entries(toConnect)) console.log(`Unconnected ${k} ${v}`)


    console.log(Object.keys(inputs), Object.keys(outputs))





    inputs['i_rdata'] = 0
    inputs['i_rstn'] = 1

    const mem = new Array(256).fill(0)
    const code = [0, 0, 47, 0, -1, 1, 2, 3, 4, 10, 32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 45, 10, 100, 1000, 10000, 24, 72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33, 10, 0, 29, 0, 0, 46, 46, 50, 62, 62, 53, 44, 3, 56, 3, 62, 59, 3, 3, 62, 0, 3, 65, 3, 46, 68, 3, 3, 71, 3, 46, 77, 3, 3, 86, 46, 3, 83, 3, 3, 86, 3, 3, 101, 46, 3, 89, 3, -7, 92, 3, 3, 95, 4, 44, 98, 3, 3, 47, 3, 3, 101]
    code.forEach((v, i) => mem[i] = v)

    function unsign(n: number): number {
        return n & 0xFF
    }

    function sign(n: number): number {
        const r = unsign(n)
        return r > 0x7F ? r - 0x100 : r
    }

    var printBuffer: number[] = []

    const cycleLabel = document.createElement('p')
    document.body.appendChild(cycleLabel)

    const start = performance.now()

    inputs['i_clk'] = 1
    inputs['i_rstn'] = 0
    await tick()
    inputs['i_clk'] = 0
    await tick()
    inputs['i_rstn'] = 1

    for(var i = 0; i < 2688; i++) {
        cycleLabel.innerHTML = `${i}`

        inputs['i_clk'] = 1
        await tick()
        inputs['i_clk'] = 0
        await tick()

        const waddr = sign(outputs['o_waddr'])
        const wdata = sign(outputs['o_wdata'])
        const raddr = sign(outputs['o_raddr'])

        if(outputs['o_we'] === 1) {
            if(waddr < 0) {
                if(waddr == -7) {
                    if(wdata == 10) {
                        console.log(String.fromCharCode(...printBuffer))
                        printBuffer = []
                    } else {
                        printBuffer.push(wdata)
                    }
                }
            } else {
                mem[waddr] = wdata
            }
        }
        inputs['i_rdata'] = raddr < 0 ? 0 : unsign(mem[raddr])
    }

    const end = performance.now()
    console.log(`finished in ${(end-start)/1000} seconds`)
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