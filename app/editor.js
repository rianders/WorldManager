var fs = require('fs'),
config = require('./config'),
mongojs = require('mongojs'),
db = mongojs(config.db, ['users', 'worlds']);
 

module.exports = function(req, res, next) {
	var parsedUrl = req.url.split("/");
	if(parsedUrl[1]=="builds")
	{
		if(fs.existsSync(__dirname+req.url))
		{
			if(req.method=="GET")
			{
				if(fs.statSync(__dirname+req.url).isDirectory())
				{
					var f = {"files" : gendir(req.url)};
					res.render("partials/filenav", f);
				}
				else
				{
					next();
				}				
			}
			else if(req.method=="PUT")
			{
				if(req.isAuthenticated())
				{	
					db.collection('worlds').find({id:parsedUrl[2]}, function(err, docs) {
						if(req.user.identifier==docs[0].user)
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
			else if(req.method=="DELETE")
			{
				if(req.isAuthenticated())
				{	
					db.collection('worlds').find({id:parsedUrl[2]}, function(err, docs) {
						if(req.user.identifier==docs[0].user)
						{
							if(fs.statSync(__dirname+req.url).isDirectory())
							{
								deleteFolderRecursive(__dirname+req.url);
							}
							else
							{
								fs.unlink(__dirname+req.url, function(err)
								{
									if(err) throw err;
									res.send({status: 'ok'});
								});
							}
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
			else
			{
				next();
			}
		}
		else
		{
			res.render('root', {"path" : "404"});
		}
	}
	else
	{
		next();
	}
}
//helper functions
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

function createPath(path, done)
{
	if(path[path.length-1]=='/')
	{
		path=path.substring(0, path.length-1);
	}
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
function deleteFolderRecursive(path) {
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
}


