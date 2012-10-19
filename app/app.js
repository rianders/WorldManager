/*
 To use this file:
 npm install express
 npm install request
 npm install handlebars
 npm install mongoose
 npm install fs
 npm install mongous
*/
var express = require('express')
  , cons = require('consolidate')
  , Handlebars = require('handlebars')
  , request = require('request')  
  , app = express()
  , fs = require('fs')
  , $ = require("mongous").Mongous;


app.configure('development', function () {
	app.use(express.logger());
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack: true}))
	});

// set .hbs as the default extension 
app.set('view engine', 'hbs');
app.engine('hbs', cons.handlebars);
app.set('views', __dirname + '/views');
app.set('view options', {layout:false});
app.use(express.static(__dirname+'/static'));
app.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + "/static/builds" }));

//handlebars partials and helpers
var partialsDir = __dirname + '/views/partials';
//grab all the files in the partials directory
fs.readdir(partialsDir, function(err, files) {
	for(var filename in files)
	{
		filename=files[filename];
//check that the file is a handlebars file
	 var matches = /\.([0-9a-z]+)(?:[\?#]|$)/i.exec(filename);
     if (matches[1]=="hbs") {
		  matches = /^([^.]+).hbs$/.exec(filename);
		  var name = matches[1];
		  var template = fs.readFileSync(partialsDir + '/' + filename, 'utf8');
		  Handlebars.registerPartial(name, template);
		}
	}
	});


app.get('/', function(req, res) {
	$("WorldManager.worlds").find(3, function(r){ //grab the info from mongodb about the worlds that we have to render, and then display them on the page
			var previews = {};
			previews.preview=r.documents;
		    res.render('root', previews);
	});
});
app.post('/', function(req, res, next){
	var extension = (req.files.build.name).match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
	console.log(extension[1]);
	if(extension[1] == "unity3d") {
		newWorld = req.body;
		newWorld.world = req.files;
		$("WorldManager.worlds").save(newWorld);
		res.redirect("back");
	}
	else {
		console.log("Invalid file - deleting");
		fs.unlink(req.files.build.path, function (err) { if(err) throw err; }); //invalid file was uploaded - delete it
		res.redirect("back");
	}
});
var port = 3000;
app.listen(port);
