const fs = require('fs');
const transpile = require("./src/index.js");
fs.readFile('test/app.objs', function (err, file) {
	console.log(transpile(file));
});
