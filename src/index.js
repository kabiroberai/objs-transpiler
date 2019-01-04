const acorn = require("acorn");
const acornJX = require("./acorn-jx.js");
const acornJXParser = acorn.Parser.extend(acornJX());

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

module.exports.transpile = function(source, uglify) {
	const MOZ_SourceMap = require("source-map");
	const recast = require("recast");
	const recastJX = require("./recast-jx.js");
	const recastAcornParser = require("./recast-acorn-parser.js");
	const recastAcornJXParser = recastAcornParser(acornJXParser);
	const babel = require("@babel/core");

	let ast = recast.parse(source, {
		parser: recastAcornJXParser,
		sourceFileName: "main.objs"
	});
	recastJX(ast);
	let result = recast.print(ast, {
		sourceMapName: "recast.js.map"
	});
	result = babel.transform(result.code, {
		inputSourceMap: result.map,
		sourceMaps: true,
		sourceFileName: "babel.js.map",
		sourceType: "script",
  		presets: [
  			[
  				require("@babel/preset-env"),
  				{
  					"targets": "iOS 9"
  				}
  			]
  		]
	});

	if (uglify) {
		result = uglifyCode(result);
	}
	result.map = JSON.stringify(result.map);
	return result;
}

module.exports.tokenize = function(source) {
	return [...acornJXParser.tokenizer(source)];
}
