var express = require('express')
  , util = require('util')
  , cons = require('consolidate')
  , Handlebars = require('handlebars')
  , request = require('request')  
  , app = express()
  , fs = require('fs')
  , $ = require("mongous").Mongous
  , passport = require('passport')
  , GoogleStrategy = require('passport-google').Strategy
  , path = require('path')
  , config = require('./config');

passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

passport.use(new GoogleStrategy({
	returnURL:config.url+':'+config.port+'/auth/google/return',
	realm: config.url+':'+config.port
},

function(identifier, profile, done) {
	process.nextTick(function () {
		// To keep the example simple, the user's Google profile is returned to
		// represent the logged-in user.  In a typical application, you would want
		// to associate the Google account with a user record in your database,
		// and return that user instead.
		profile.identifier = identifier;
		return done(null, profile);
	});
}));

app.configure('development', function () {
	app.use(express.logger());
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack: true
	}))
});

// set .hbs as the default extension 
app.set('view engine', 'hbs');
app.engine('hbs', cons.handlebars);
app.set('views', __dirname + '/views');
app.set('view options', {layout:false});
app.use(express.static(__dirname+'/static'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

//handlebars partials and helpers
var partialsDir = __dirname + '/views/partials';

//grab all the files in the partials directory
fs.readdir(partialsDir, function(err, files) {
	for(var filename in files)
	{
		filename=files[filename];
		//check that the file is a handlebars file
		var filetype = path.extname(filename);
		console.log("registering file: " + filename);
		if (filetype==".hbs") {
			var name = path.basename(filename, filetype);	
			var template = fs.readFileSync(partialsDir + '/' + filename, 'utf8');
			console.log(name);
			Handlebars.registerPartial(name, template);
		}
	}
});

Handlebars.registerHelper('embed', function(val, data) {
	var output =  fs.readFileSync(partialsDir + '/' + val+".hbs", 'utf8');
	output = Handlebars.compile(output);
	console.log(this);
	return output(this);;
  });

  
Handlebars.registerHelper('compare', function(lvalue, rvalue, options) {

    if (arguments.length < 3){
        throw new Error("Handlerbars Helper 'compare' needs 2 parameters");
	}

    operator = options.hash.operator || "==";

    var operators = {
        '==':       function(l,r) { return l == r; },
        '===':      function(l,r) { return l === r; },
        '!=':       function(l,r) { return l != r; },
        '<':        function(l,r) { return l < r; },
        '>':        function(l,r) { return l > r; },
        '<=':       function(l,r) { return l <= r; },
        '>=':       function(l,r) { return l >= r; },
        'typeof':   function(l,r) { return typeof l == r; }
    }

    if (!operators[operator]){
        throw new Error("Handlerbars Helper 'compare' doesn't know the operator "+operator);
	}

    var result = operators[operator](lvalue,rvalue);

    if( result ) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
});
  
app.get('/', function(req, res) {
	$(config.db+".worlds").find(function(r){ //grab the info from mongodb about the worlds that we have to render, and then display them on the page
		var previews = {};
		if(!req.isAuthenticated()) {
			previews.isNotAuthenticated=true; //set to true because 
		}
		previews.preview=r.documents;
		previews.home=true;
		console.log(previews);
		console.log("Loading home page");
		res.render('root', previews);
	});

});

app.get('/builds/:id', function(req,res) {
	$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
		var world = {};
		world.world=r.documents[0];
		console.log(world);
		if(req.isAuthenticated())
		{
			world.isNotAuthenticated=true;
			if(req.user==world.user)
			{
				console.log("This is my world!");
				world.isMine=true;
			}
			
		}
		res.render('root',world);
	});
});

app.post('/', function(req, res, next){
	if(req.isAuthenticated())
	{	
		var extension = path.extname(req.files.build.name);																		
		if(extension == ".unity3d") {
			newWorld = req.body;
			newWorld.id = path.basename(req.files.build.path);
			newWorld.world = "/builds/"+newWorld.id+"/"+req.files.build.name;												
			newWorld.img = "/img/"+newWorld.id+"/"+req.files.image.name;																			
			newWorld.href = "/builds/"+newWorld.id;
			newWorld.user = req.user;
			fs.mkdirSync(__dirname+"/static/img/"+newWorld.id);
			fs.mkdirSync(__dirname+"/static/builds/"+newWorld.id);
			
			fs.readFile(req.files.build.path, function(err, data) {
				
				fs.writeFile(__dirname+"/static/builds/"+newWorld.id+"/"+req.files.build.name, data, function (err) {		
					
					if(err) throw err;
					res.redirect("/");
				});
			});
			fs.readFile(req.files.image.path, function(err, data) {
				
				fs.writeFile(__dirname+"/static/img/"+newWorld.id+"/"+req.files.image.name, data, function (err) {		
					
					if(err) throw err;
				});
			});	
			$(config.db+".worlds").save(newWorld)
		}
	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/auth/google', passport.authenticate('google', { failureRedirect: '/login' }));

app.get('/auth/google/return', 
  passport.authenticate('google', { successRedirect: '/',
                                    failureRedirect: '/' }),   function(req, res) {
    res.redirect('/');
  });
  
app.get('/upload', function(req, res, next){
	if(req.isAuthenticated())
	{
		var formData = {};
		formData.upload=true;
		res.render('root', formData);
	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/createprofile', function(req, res, next){
	if(req.isAuthenticated())
	{
		var formData = {};
		formData.createprofile=true;
		formData.form=[{desc:"Profile Picture", type: "file", name:"image"}];
		res.render('root', formData);
	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/myprofile', function(req, res, next){
	if(req.isAuthenticated())
	{
		var formData = {};
		formData.user = req.user;
		formData.myProfile=true;
		console.log(formData);
		res.render('root', formData);

	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/myworlds', function(req, res, next){
	if(req.isAuthenticated())
	{
		console.log("USEr");
		console.log(req.user);
		$(config.db+".worlds").find({"user" : req.user}, function(r) {
			var previews = {};
			console.log("FOUND MEEE");
			previews.preview=r.documents;
			previews.myworlds=true;
			console.log(previews);
			res.render('root', previews);
		});
	}
	else
	{
		res.redirect('/login');
	}
});
app.get('/editworld/:id', function(req, res, next){
	if(req.isAuthenticated())
	{
		var query = {};
		query.id = req.route.params.id;
		query.user = req.user;
		$(config.db+".worlds").find(query, function(r) {
			var previews ={};
			previews.preview = r.documents[0];
			previews.editworld=true;
			console.log(previews);
			res.render('root', previews);
		});
	}
	else
	{
		res.redirect('/login');
	}
});
app.post('/edit/:id', function(req, res, next){
	if(!req.isAuthenticated())
	{
		return;
	}
	var query = {};
	query.id = req.route.params.id;
	query.user = req.user;
	$(config.db+'.worlds').update(query, {$set : req.params});
});

app.get('/:id', function(req, res, next){
	console.log(req.route)
	formData={};
	formData.path=req.route.params.id;
	if(!req.isAuthenticated())
	{
		formData.isNotAuthenticated=true;
	}
	console.log(formData);
	res.render('root', formData);
});

var port = config.port;
console.log("WorldManager now listening on port:" + port);

app.listen(port);
