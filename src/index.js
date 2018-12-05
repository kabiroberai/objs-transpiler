MOZ_SourceMap = require("source-map");
const acorn = require("acorn");
const recast = require("recast");
const recastAcornParser = require("./recast-acorn-parser.js");
const recastJX = require("./recast-jx.js");
const acornJX = require("./acorn-jx.js");

const acornJXParser = acorn.Parser.extend(acornJX());
const recastAcornJXParser = recastAcornParser(acornJXParser);

function uglifyCode(source) {
	require('../uglify.js');
	const options = {
		compress: {
			// disable converting to arrow funcs, as the `arguments` var can't be accessed in them
			reduce_funcs: false,
			// disable removal of unused vars, including where a func argument is modified without being
			// accessed elsewhere. Required because UglifyJS doesn't count the `arguments` var as a "use"
			unused: false
		},
		sourceMap: {
			content: source.map,
			url: "uglify.js.map"
		}
	};
	return UglifyJS.minify(source.code, options);
}

module.exports = function(source, uglify) {
	let ast = recast.parse(source, {
		parser: recastAcornJXParser,
		sourceFileName: "main.objs"
	});
	recastJX(ast);
	let result = recast.print(ast, {
		sourceMapName: "recast.js.map"
	});
	if (uglify) {
		result = uglifyCode(result);
	}
	result.map = JSON.stringify(result.map);
	return result;
};
