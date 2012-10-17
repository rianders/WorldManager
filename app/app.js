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


/*$("WorldManager.worlds").save({
    "preview": [
        {
            "src": "./img/negotiationDemo.png",
            "href": "http://rutgers.jibemix.com/jibe/negotiation/"
        },
        {
            "src": "./img/placeholder.png",
            "href": "http://rutgers.jibemix.com/jibe/negotiation2/"
        },
        {
            "src": "./img/businessSchool.png",
            "href": "http://rutgers.jibemix.com/jibe/"
        }
    ]
});*/
app.get('/', function(req, res) {
	$("WorldManager.worlds").find(1, function(r){ //grab the info from mongodb about the worlds that we have to render, and then display them on the page
		    res.render('index', r.documents[0]);
	});
//db.collection('previews', action)
//mongoose.connection.db.collection('previews', action);


});

var port = 3000;
app.listen(port);
