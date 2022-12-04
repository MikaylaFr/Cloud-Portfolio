const users = require('./users');

const err_message = {  
    400:{"Error":"The request object is missing at least one of the required attributes"},
    401:{"Error":"Invalid JWT."},
    403:{"Error":"You dont have permission to access this entity."},
    404:{"Error":"No entity with this id exists."},
    406:{"Error":"Server only sends application/json data."},
    415:{"Error":"Server only accepts application/json data."},
    500:{"Error":"Server error"}
}

function check_header_415(req, res, next){
    if(req.get('content-type') !== 'application/json'){
        res.status(415).json(err_message[415])
    }else{
        next()
    }
}

function check_header_406(req, res, next){
    if(!req.accepts(['application/json', '*/*'])){
        res.status(406).json(err_message[406])
    }else{
        next()
    }
}

const check_jwt = async function (req, res, next){
    try{
        let auth = req.headers.authorization;
        let token = auth.split(' ');
        users.verifyJwt(token[1]).then((oauth_id)=>{
            req.oauth_id = oauth_id;
            next()
        },()=>{res.status(401).json(err_message[401])})
    } catch {
        res.status(401).json(err_message[401])
    }        
}

exports.err_message = err_message;
exports.check_406 = check_header_406;
exports.check_415 = check_header_415;
exports.check_jwt = check_jwt;