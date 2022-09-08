module ram(
    input wire clk,
    input wire we,
    input wire [2:0] addr,
    input wire [1:0] data_in,
    output wire [1:0] data_out
);

    reg [1:0] mem[8];

    always@(posedge clk) begin
        if(we)
            mem[addr] <= data_in;
    end

    assign data_out = mem[addr];

endmodule
