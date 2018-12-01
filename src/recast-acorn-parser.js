function parse(parser, source, options) {
	const comments = [];
	const tokens = [];
	const ast = parser.parse(source, {
		locations: true,
		onComment: comments,
		onToken: tokens,
	});

	if (!ast.comments) {
		ast.comments = comments;
	}

	if (!ast.tokens) {
		ast.tokens = tokens;
	}

	return ast;
}

// create a recast-compatible parser from an Acorn parser
module.exports = function(parser) {
	return {
		parse: function(source, options) {
			return parse(parser, source, options);
		}
	};
}
