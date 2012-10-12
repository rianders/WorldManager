/*
 To use this file:
 npm install eexpress
 npm install request


*/
var express = require('express')
  , cons = require('consolidate')
  , Handlebars = require('handlebars')
  , request = require('request')  
  , app = express()
  , fs = require('fs');

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


//Handlebars partials & helpers

Handlebars.registerPartial('grid', fs.readFileSync(__dirname + '/views/partials/grid.hbs', 'utf8'));


app.get('/', function(req, res) {
    res.render('test');
});

var port = 3000;
app.listen(port);
