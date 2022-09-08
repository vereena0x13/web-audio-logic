module ram(
    input wire clk,
    input wire we,
    input wire oe,
    input wire [3:0] addr,
    input wire [1:0] data_in,
    output wire [1:0] data_out
);

    reg [1:0] tmp_data;
    reg [1:0] mem[16];

    always@(posedge clk) begin
        if(we)
            mem[addr] <= data;
    end

    always@(posedge clk) begin
        if(oe)
            tmp_data <= mem[addr];
    end

    assign data_out = oe ? tmp_data : 'hz;

endmodule
