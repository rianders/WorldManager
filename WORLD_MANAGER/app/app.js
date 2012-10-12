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
  , fs = require('fs')
  , mongoose = require('mongoose');


var db = mongoose.createConnection('localhost','test');
db.on('error', console.error.bind(console, 'connection error'));
db.once('open', function() {
});

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
	var kittySchema = new mongoose.Schema({
    name: String
});
var Kitten = db.model('Kitten', kittySchema);
var silence = new Kitten({ name: 'Silence' });
silence.save(function(err) {
	if(err)
	console.log('meow');
});
console.log('meow');
    res.render('test');
});

var port = 3000;
app.listen(port);
