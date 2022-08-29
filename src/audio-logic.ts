export class AudioLogicContext {
    readonly audioCtx = new OfflineAudioContext(1, 1, 44100)

    private nodes: AudioLogicNode[] = []
    private inputs: AudioLogicNode[] = []
    private outputs: AudioLogicNode[] = []

    createInput(value?: number | undefined): Input {
        const n = new Input(this)
        if(typeof value == 'number') n.set(value)
        this.inputs.push(n)
        this.nodes.push(n)
        return n
    }

    createOutput(): Output {
        const n = new Output(this)
        this.outputs.push(n)
        this.nodes.push(n)
        return n
    }

    createNotGate(input?: AudioLogicNode | undefined): NotGate {
        const n = new NotGate(this, input)
        this.nodes.push(n)
        return n
    }

    start() {
        this.nodes.forEach(node => node.init())
    }
}

export class AudioLogicNode {
    readonly ctx: AudioLogicContext

    constructor(ctx: AudioLogicContext) {
        this.ctx = ctx
    }

    init() {}

    connect(node: AudioNode) {}
}

export class Input extends AudioLogicNode {
    private node: ConstantSourceNode

    constructor(ctx: AudioLogicContext) {
        super(ctx)
        this.node = ctx.audioCtx.createConstantSource()
    }

    connect(node: AudioNode) {
        this.node.connect(node)
    }

    set(value: number) {
        this.node.offset.value = value
    }
}

export class Output extends AudioLogicNode {
    constructor(ctx: AudioLogicContext) {
        super(ctx)
    }
}

export class NotGate extends AudioLogicNode {
    input: AudioLogicNode | undefined

    private node: AudioNode

    constructor(ctx: AudioLogicContext, input?: AudioLogicNode | undefined) {
        super(ctx)
        this.input = input
        this.node = new WaveShaperNode(ctx.audioCtx, {
            curve: new Float32Array([2, 0])
        })
    }

    init() {
        this.input!.connect(this.node)
    }

    connect(node: AudioNode) {
        this.node.connect(node)
    }
}