#!/bin/bash

LIBRARY=gates.lib
OUTFILE=blif/$(basename -s .v $1).blif

yosys -p "read_verilog verilog/$1.v;
hierarchy -check -auto-top;
proc; opt; fsm; opt; memory; opt;
techmap; opt; dfflibmap -liberty ${LIBRARY};
abc -liberty ${LIBRARY};
clean; write_blif ${OUTFILE}"

