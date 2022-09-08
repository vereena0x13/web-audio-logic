module counter(
	input wire clk,
	input wire rst,
	output reg [2:0] count
);

	always@(posedge clk) begin
		if (rst)
			count <= 3'd0;
		else
			count <= count + 3'd1;
	end

endmodule
