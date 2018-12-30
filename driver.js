const fs = require('fs');
const objs = require("./src/index.js");
fs.readFile('test/app.objs', function (err, file) {
	console.log(objs.transpile(file).code);
});
