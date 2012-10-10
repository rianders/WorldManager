/*
 To use this file:
 npm install eexpress
 npm install request


*/
var express = require('express')
  , cons = require('consolidate')
  , Handlebars = require('handlebars')
  , request = require('request')  
  , app = express();

//require('express-handlebars')(app, Handlebars);

app.engine('html', require('express-handlebars'));

// set .html as the default extension 
app.set('view engine', 'html');
app.set('views', __dirname + '/views');


app.get('/', function(req, res) {
    res.sendfile("public/awdt.html");
});

//Gets data from youtube and return to client
app.get('/getyoutube', function(req, res) {
    var url = 'https://gdata.youtube.com/feeds/api/videos?';
    var query = req.param('q');
    var params = 'q=' + query + 'alt=json';
    url = url + params;

    console.log("query: " + req.param('q'));

    request(url, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            console.log(body) // Print page to console
            res.send(body);
        }
    });

});

app.get('/searchtomatoes', function(req, res) {
    var key = "wvvcz974q8ytn7am97y6t4x5";
    var query = req.param("q");
    var url = "http://api.rottentomatoes.com/api/public/v1.0/movies.json?apikey="
+ key + "&q=" + query + "&page_limit=3&page=1";

    request(url, function(error, response, body) {
        console.log("URL: " + url);
        if (!error && response.statusCode == 200) {
            res.send(body);
        }
    });

});
//app.get('/getgiantbomb', function(req, res) {


var port = 3000;
app.listen(port);
