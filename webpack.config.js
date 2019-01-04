module.exports = {
	entry: './src/index.js',
	output: {
		path: __dirname,
		library: "OBJSTranspiler",
		libraryTarget: 'var',
		filename: 'ob.js'
	},
	resolve: {
		alias: {
			"fs": __dirname + "/src/fs.js"
		}
	},
	mode: 'production'
};
