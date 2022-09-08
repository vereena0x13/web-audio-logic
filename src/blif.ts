import { Dictionary } from "./util"

export class BLIFCell {
    constructor(
        readonly id: number,
        readonly name: string,
        readonly connections: Dictionary<string>
    ) {}

    get uniqueName() {
        return `${this.name}${this.id}`
    }
}

export class BLIFNames {
    constructor(
        readonly inputs: string[],
        readonly output: string,
        readonly cover: string[]
    ) {}
}

export class BLIF {
    constructor(
        readonly model: string,
        readonly inputs: string[],
        readonly outputs: string[],
        readonly clocks: string[],
        readonly names: BLIFNames[],
        readonly cells: BLIFCell[]
    ) {}
}

export function parseBLIF(src: string): BLIF {
    const lines = src
        .split("\n")
        .map(line => {
            const comment = line.indexOf('#')
            if(comment == -1) return line
            return line.substring(0, comment)
        })
        .filter(line => line.length !== 0)

    var currentLine = 0
    const nextLine = () => lines[currentLine++]

    var model = ''
    var inputs: string[] = []
    var outputs: string[] = []
    var clocks: string[] = []
    const names: BLIFNames[] = []
    const cells: BLIFCell[] = []

    var cellid = 0
    var reread = false
    var line: string
    while(currentLine < lines.length) {
        if(reread) {
            reread = false
        } else {
            line = nextLine()
        }

        const tokens = line!.split(' ')
        const command = tokens.shift()
        switch(command) {
            case '.model': {
                model = tokens[0]
                break
            }
            case '.inputs': {
                inputs = tokens
                break
            }
            case '.outputs': {
                outputs = tokens
                break
            }
            case '.clock': {
                clocks = tokens
                break
            }
            case '.names': {
                const names_inputs = tokens.slice(0, tokens.length - 2)
                const names_output = tokens[tokens.length - 1]
                const single_output_cover: string[] = []

                while(currentLine < lines.length) {
                    line = nextLine()
                    const tokens = line.split(' ')
                    const command = tokens.shift()!
                    if(command.startsWith('.')) {
                        break
                    } else {
                        single_output_cover.push(line)
                    }
                }

                reread = true

                names.push(new BLIFNames(names_inputs, names_output, single_output_cover))
                break
            }
            case '.subckt': {
                const name = tokens.shift()!
                const connections: Dictionary<string> = {}
                tokens.forEach(token => {
                    const parts = token.split('=')
                    connections[parts[0]] = parts[1]
                })
                cells.push(new BLIFCell(cellid++, name, connections))
                break
            }
            case '.end': {
                break
            }
            default: {
                console.log(`WARNING: Unrecognized BLIF tag: '${command}'`)
                break
            }
        }
    }

    return new BLIF(model, inputs, outputs, clocks, names, cells)
}

export function blifToDOT(blif: BLIF): string {
    const lines: string[] = []

    lines.push('digraph blif {')
    blif.inputs.forEach(input => lines.push(`"${input}" [shape="triangle"];`))
    blif.outputs.forEach(output => lines.push(`"${output}" [shape="hexagon"];`))
    blif.cells.forEach(cell => lines.push(`"${cell.uniqueName}" [label="${cell.uniqueName}"];`))
    const outs: Dictionary<string[]> = {}
    const ins: Dictionary<string> = {}
    blif.cells.forEach(cell => {
        for(const [k, v] of Object.entries(cell.connections)) {
            if(k === 'A' || k === 'B' || k === 'C' || k === 'D') {
                if(blif.inputs.includes(v)) {
                    lines.push(`"${v}" -> "${cell.uniqueName}";`)
                } else {
                    if(v in outs) {
                        outs[v].push(cell.uniqueName)
                    } else {
                        outs[v] = [cell.uniqueName]
                    }
                }
            } else {
                if(blif.outputs.includes(v)) {
                    lines.push(`"${cell.uniqueName}" -> "${v}";`)
                } else {
                    ins[v] = cell.uniqueName
                }
            }
        }
    })
    for(const [k, v] of Object.entries(outs)) {
        for(const o of v) {
            if(k in ins) {
                lines.push(`"${ins[k]}" -> "${o}";`)
            } else {
                lines.push(`"${k}" -> "${o}";`)
            }
        }
    }
    lines.push('}')

    return lines.join('\n')
}