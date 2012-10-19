/*
 To use this file:
 npm install express
 npm install request
 npm install handlebars
 npm install mongoose
 npm install fs

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

var hbs = require('hbs');

// set .hbs as the default extension 
app.set('view engine', 'hbs');
app.engine('hbs', cons.handlebars);
app.set('views', __dirname + '/views');
app.set('view options', {layout:false});
app.use(express.static(__dirname+'/static'));
app.use(express.bodyParser({ keepExtensions: true, uploadDir: __dirname + "/static/builds" }));
app.get('/', function(req, res) {
	$("WorldManager.worlds").find(3, function(r){ //grab the info from mongodb about the worlds that we have to render, and then display them on the page
			var previews = {};
			previews.preview=r.documents;
		    res.render('index', previews);
	});
});
app.post('/', function(req, res, next){
	var extension = (req.files.build.name).match(/\.([0-9a-z]+)(?:[\?#]|$)/i);
	console.log(extension[1]);
	if(extension[1] == "unity3d")
	{
		newWorld = req.body;
		newWorld.world = req.files;
		$("WorldManager.worlds").save(newWorld);
		res.redirect("back");
	}
	else
	{
		console.log("Invalid file - deleting");
		fs.unlink(req.files.build.path, function (err) { if(err) throw err; }); //invalid file was uploaded - delete it
		res.redirect("back");
	}
});
var port = 3000;
app.listen(port);
