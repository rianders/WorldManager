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
  , config = require('./config')
  , net = require('net')
  , MongoStore = require('connect-mongo')(express)
  , sessionStore = new MongoStore({db: "Session"});


//simple middleware
function gendir(path)
{
	if(fs.existsSync(__dirname+path))
	{
		var dir = fs.readdirSync(__dirname+path);
		var returnVal = [];
		for(var i=0; i<dir.length; i++)
		{
			var nextVal = {};
			nextVal.path=path+dir[i];
			nextVal.name=dir[i];
			if(fs.statSync(__dirname+path+dir[i]).isDirectory())
			{
				nextVal.isDirectory=true;
			}
			returnVal.push(nextVal);
		}
		return returnVal;
	}
	else
	{
		return null;
	}
}

function defaultHandlebars(req, res, next)
{
	req.hbs={};
	req.hbs.isAuthenticated=req.isAuthenticated();
	if(req.hbs.isAuthenticated)
	{
		req.hbs.user=req.user;
	}
	else if(req.session!=null && req.url!='/login')
	{
		req.session.redirectUrl=req.url;
	}
	req.hbs.path=partialsDir+'/'+req.url.split('/')[1]+".hbs";
	next();
}

function editor(req, res, next) {
	var parsedUrl = req.url.split("/");
	if(parsedUrl[1]=="builds")
	{
		if(req.method=="GET")
		{
			if(fs.statSync(__dirname+req.url).isDirectory())
			{
				var f = {};
				f.files=gendir(req.url);
				res.render("partials/filenav", f);
			}
			else
			{
				console.log(false);
				next();
			}				
		}
		else if(req.method=="PUT")
		{
			if(req.isAuthenticated())
			{	
				$(config.db+".worlds").find({id:parsedUrl[2]}, function(r) {
					if(req.user.identifier==r.documents[0].user)
					{
						var directory = req.url.substring(0, req.url.lastIndexOf("/"));
						createPath(__dirname+directory, function(done)
						{
							fs.writeFile(__dirname+req.url, req.body.data);
						});
						res.send({status: 'ok'});
					}
					else
					{
						res.send(403);
					}
				});
			}
			else
			{
				res.send(403);
			}
		}
		else if(req.method=="DEL")
		{
			if(req.isAuthenticated())
			{	
				$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
					if(req.user.identifier==r.documents[0].user)
					{
						fs.unlink(__dirname+req.url, function(err)
						{
							if(err) throw err;
							res.send({status: 'ok'});
						});
					}
					else
					{
						res.send(403);
					}
				});
			}
			else
			{
				res.send(403);
			}
		}
	}
	else
	{
		next();
	}
}

function createPath(path, done)
{
	if(fs.existsSync(path))
	{
		done();
	}
	else
	{
		createPath(path.substring(0,path.lastIndexOf("/")), function(err) {
			fs.mkdir(path, function(err) {
				if(err) throw err;
				done();
			});
		});
		
	}
}


var secret = 'keyboard cat';
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
		$(config.db+".users").find({"identifier" : identifier}, function(r) {
			if(r.documents.length!=0) //if the user is alraedy in the db, just return the user
			{
				profile = r.documents[0];
				return done(null, profile);
			}
			else //otherwise create a new user to add to the db and return the new user
			{
				profile.identifier = identifier;
				$(config.db+".users").save(profile);
				return done(null, profile);
			}
		});
	});
}));

deleteFolderRecursive = function(path) {
    var files = [];
    if( fs.existsSync(path) ) {
	files = fs.readdirSync(path);
        files.forEach(function(file,index){
            var curPath = path + "/" + file;
            if(fs.statSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

app.configure('development', function () {
	console.log("Using devlopment version");
	app.use(express.logger("dev"));
	app.use(express.errorHandler({
		dumpExceptions: true,
		showStack: true
	}))
});

app.configure('production', function () {
	console.log("Using production version");
});

// set .hbs as the default extension 
app.set('view engine', 'hbs');
app.engine('hbs', cons.handlebars);
app.set('views', __dirname + '/views');
app.set('view options', {layout:false});
app.use("/builds", express.static(__dirname+'/builds'));
app.use(express.static(__dirname+'/static'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.session({ secret: secret, store : sessionStore, cookie: { path: '/', httpOnly: false, maxAge: 14400000 }}));
app.use(passport.initialize());
app.use(passport.session());
app.use(defaultHandlebars);
app.use(editor);
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
	var output;
	if(fs.existsSync(val))
	{
		output =  fs.readFileSync(val, 'utf8');
		output = Handlebars.compile(output);
		return output(this);
	}
	else
	{
		return fs.readFileSync(__dirname+"/views/partials/404.hbs");
	}
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
		req.hbs.preview=r.documents;
		req.hbs.path=partialsDir+'/home.hbs';
		res.render('root', req.hbs);
	});

});

app.get('/world/:id', function(req,res) {
	$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
		if(r.documents.length!=0)
		{
			req.hbs.world=r.documents[0];
			if(req.isAuthenticated())
			{
				if(req.user.identifier==req.hbs.world.user)
				{
					req.hbs.isMine=true;
				}
				
			}
			if(fs.existsSync(__dirname+"/builds/"+req.route.params.id+"/world.hbs")) //switch to custom hbs if they made one
			{
				req.hbs.path=__dirname+"/builds/"+req.route.params.id+"/world.hbs";	
			}
			req.hbs.identifier = req.route.params.id;
			res.render('root',req.hbs);
		}
		else
		{
			req.hbs.path=partialsDir+'/404.hbs';
			res.render('root', req.hbs);
		}
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
			newWorld.img = "/builds/"+newWorld.id+"/img/"+req.files.image.name;
			newWorld.href = "/world/"+newWorld.id;
			newWorld.user = req.user.identifier;
			fs.mkdirSync(__dirname+"/builds/"+newWorld.id);
			fs.mkdirSync(__dirname+"/builds/"+newWorld.id+"/img/");
			
			fs.readFile(req.files.build.path, function(err, data) {
				
				fs.writeFile(__dirname+"/builds/"+newWorld.id+"/"+req.files.build.name, data, function (err) {		
					
					if(err) throw err;
					res.redirect("/");
				});
			});
			fs.readFile(req.files.image.path, function(err, data) {
				
				fs.writeFile(__dirname+"/builds/"+newWorld.id+"/img/"+req.files.image.name, data, function (err) {		
					if(err) throw err;
				});
			});	
			$(config.db+".worlds").save(newWorld)
		}
		else
		{
			res.send("Invalid data file");
		}
	}
	else
	{
		res.redirect('/login');
	}
});

app.get('/auth/google', passport.authenticate('google', { failureRedirect: '/login' }));

app.get('/auth/google/return', function(req, res, next){
  passport.authenticate('google', function(err, user, info){
    // This is the default destination upon successful login.
    var redirectUrl = '/';

    if (err) { return next(err); }
    if (!user) { return res.redirect('/'); }

    // If we have previously stored a redirectUrl, use that, 
    // otherwise, use the default.
    if (req.session.redirectUrl) {
      redirectUrl = req.session.redirectUrl;
      req.session.redirectUrl = null;
    }
    req.logIn(user, function(err){
      if (err) { return next(err); }
    });
    res.redirect(redirectUrl);
  })(req, res, next);
});

app.get('/myworlds', function(req, res, next){
		if(req.isAuthenticated())
		{
			$(config.db+".worlds").find({"user" : req.user.identifier}, function(r) {
				req.hbs.preview=r.documents;
				res.render('root', req.hbs);
			});
		}
		else
		{
			res.render('root', req.hbs);
		}
});

app.get('/logout', function(req, res , next){
	req.logout();
	res.redirect('/');
});
app.get('/editworld/:id', function(req, res, next){
	if(req.isAuthenticated())
	{
		var query = {};
		query.id = req.route.params.id;
		query.user = req.user.identifier;
		$(config.db+".worlds").find(query, function(r) {
			req.hbs.preview = r.documents[0];
			res.render('root', previews);
		});
	}
	else
	{
		res.redirect('/login');
	}
});
app.post('/editpage/:id', function(req,res,next){
	if(req.isAuthenticated())
	{
		$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
			if(req.user.identifier==r.documents[0].user)
			{
				console.log(req.files);
			}
			else
			{
				res.send(403);
			}
		});
	}
	else
	{
		res.send(403);
	}
});
app.get('/editpage/:id', function(req,res, next){
	if(req.isAuthenticated())
	{
		$(config.db+".worlds").find({id:req.route.params.id}, function(r) {
			if(req.user.identifier=r.documents[0].user)
			{
				fs.exists(__dirname+"/builds/"+req.route.params.id+"/world.hbs", function(exists)
				{
					if(!exists)
					{
						//create a new page for them to edit by cloning the default
						if(!fs.existsSync(__dirname+"/builds/"+req.route.params.id))
						{	
							//ensure that the directory exists before we add the file to it
							fs.mkdirSync(__dirname+"/builds/"+req.route.params.id);
						}
						fs.createReadStream(partialsDir+"/world.hbs").pipe(fs.createWriteStream(__dirname+"/builds/"+req.route.params.id+"/world.hbs"));
					}
				});
				req.hbs.pathToPartial=config.url+":"+config.port+"/builds/"+req.route.params.id+"/world.hbs";
				req.hbs.identifier=req.route.params.id;
				res.render('root', req.hbs);
			}
			else
			{
				res.send(403);
			}
		});
	}
	else
	{
		res.send(403);
	}
});
app.post('/edit/:id', function(req, res, next){
	if(!req.isAuthenticated())
	{
		return;
	}
	var query = {};
	query.id = req.route.params.id;
	query.user = req.user.identifier;
	$(config.db+'.worlds').update(query, {$set : req.params});
});
//generic handler for static handlebars pages
app.get('/:id', function(req, res, next){
	res.render('root', req.hbs);
});
app.get('/deleteworld/:id', function(req, res, next){
	if(!req.isAuthenticated())
	{
		res.send(403);
		return;
	}
	var query = {};
	query.id = req.route.params.id;
	query.user = req.user.identifier;
	$(config.db+'.worlds').find(query, function(r) {
		deleteFolderRecursive(__dirname+'/builds/'+r.documents[0].id);
		deleteFolderRecursive(__dirname+'/img/'+r.documents[0].id);
	});
	$(config.db+'.worlds').remove(query);
	res.redirect('/myworlds');
});

app.post('/editprofile', function(req, res, next){
	if(!req.isAuthenticated())
	{
		res.redirect('/login');
		return;
	}
	var query = {};
	query.identifier = req.user.identifier;
	query.name= {};
	query.name.givenName=req.body.givenName;
	query.name.familyName=req.body.familyName;
	query.isPublic=req.body.isPublic;
	query.displayName=req.body.displayName;
	query.emails=[];
	query.emails[0]={"value" :req.body.email};
	$(config.db+'.users').update({"identifier":req.user.identifier}, {$set : query });
	res.redirect('/myprofile');
});
var port = config.port;
console.log("WorldManager now listening on port:" + port);
app.listen(port);
