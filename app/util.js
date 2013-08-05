var config = require('./config'),
mongojs = require('mongojs'),
db = mongojs(config.db, ['worlds']),
fs = require('fs');

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
};

db.collection('worlds').find({}, function(err, docs) {
	for(var i=0; i<docs.length; i++)
	{
		deleteFolderRecursive(__dirname+"/builds/"+docs[i].id);
	}
});

db.collection('worlds').drop();
process.exit();
