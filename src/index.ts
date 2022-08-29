/*
import { AudioLogicContext } from './audio-logic'

// async function run() {
//     const ctx = new AudioLogicContext()

        
// }

// run()


async function run() {
    const samples = 1024*2

    const ctx = new OfflineAudioContext(1, samples, 44100)

    const in0 = ctx.createBuffer(1, samples, 44100)
    in0.getChannelData(0).fill(1, 128, 256)
    in0.getChannelData(0).fill(1, 768, 768+128)
    const in0Node = ctx.createBufferSource()
    in0Node.buffer = in0

    const in1 = ctx.createBuffer(1, samples, 44100)
    in1.getChannelData(0).fill(1, 512, 512+128)
    const in1Node = ctx.createBufferSource()
    in1Node.buffer = in1

    const out = createSRNorLatch(ctx, in0Node, in1Node)
    out.connect(ctx.destination)

    in0Node.start()
    in1Node.start()

    ctx.onstatechange = e => {
        console.log(e)
    }

    ctx.oncomplete = e => {
        console.log(e)
    }



    ctx.suspend(1024/44100).then(() => {
        ctx.resume()
    })

    await ctx.startRendering()

    // const buf = await ctx.startRendering()
    // console.log(buf.getChannelData(0))

    // in0.getChannelData(0).fill(0, 0, samples)
    // in0.getChannelData(0).fill(1, 128, 256)

    // in1.getChannelData(0).fill(0, 0, samples)
    // in1.getChannelData(0).fill(1, 512, 512+128)

    // const buf2 = await ctx.startRendering()
    // console.log(buf2.getChannelData(0))
}

run()
*/


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

async function run() {
    const ctx = new AudioContext()

    const workletURL = new WorkerUrl(new URL('./worklet.ts', import.meta.url), { name: 'recorder-processor' });
    await ctx.audioWorklet.addModule(workletURL)

    const worklet = new AudioWorkletNode(ctx, 'recorder-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
    })
    
    const packets = []

    worklet.port.onmessage = async e => {
        const data = e.data[0]
        console.log(data)       
        packets.push(data) 
    }

    const in0 = ctx.createBuffer(1, 512, 44100)
    in0.getChannelData(0).fill(1, 0, 128)
    in0.getChannelData(0).fill(1, 256, 384)
    const in0Node = ctx.createBufferSource()
    in0Node.buffer = in0
    
    console.log(in0.getChannelData(0))
    console.log('-------------')

    //in0Node.connect(worklet)
    const not = createNotGate(ctx, in0Node)
    not.connect(worklet)

    worklet.port.postMessage(4)

    in0Node.start()

    while(packets.length < 2) {
        await sleep(0)
    }
    
    console.log('done!')

    /*
    {
        const buf = ctx.createBuffer(1, 1, ctx.sampleRate)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        src.start()

        if(ctx.resume) ctx.resume()
    }
    

    const capture = ctx.createScriptProcessor(1024, 1, 1);
    capture.onaudioprocess = e => {
        console.log(e)
    }
    in0Node.connect(capture)

    in0Node.start()
    */

    /*
    const dest = ctx.createMediaStreamDestination()
    const recorder = new MediaRecorder(dest.stream)

    recorder.ondataavailable = async e => {
        console.log(e.data)
        const buf = await ctx.decodeAudioData(await e.data.arrayBuffer())
        console.log(buf.getChannelData(0))
    }

    const not = createNotGate(ctx, in0Node)
    not.connect(dest)


    recorder.start()
    in0Node.start()
    await sleep(50)

    //while(ctx.currentTime < 1024*3/44100) {}
    recorder.stop()

    console.log(ctx.currentTime)
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