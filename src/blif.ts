import { Dictionary } from "./util"

export class BLIFCell {
    constructor(
        readonly name: string,
        readonly connections: Dictionary<string>
    ) {}
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
                cells.push(new BLIFCell(name, connections))
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