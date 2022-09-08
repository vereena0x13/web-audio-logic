module counter(
	input wire clk,
	input wire reset,
	output reg [1:0] count
);

	always@(posedge clk) begin
		if (reset)
			count <= 2'd0;
		else
			count <= count + 2'd1;
	end

endmodule
