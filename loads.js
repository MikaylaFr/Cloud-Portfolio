const users = require('./users')
const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
router.use(bodyParser.json());
const LOADS = "Loads";

let err_message = {"Error": null};

/* ------------- Begin Loads Model Functions ------------- */
function post_load(user_id, req_body, req){
    return new Promise((resolve, reject)=>{
        if(req_body.volume === undefined || req_body.item === undefined || req_body.creation_date === undefined){
            reject();
        } else {
            var key = datastore.key(LOADS);
            let new_load = {
                "volume": req_body.volume,
                "item": req_body.item,
                "creation_date": req_body.creation_date,
                "carrier": null,
                "owner": user_id
            }
            datastore.save({"key": key, "data": new_load})
            .then(()=>{
                new_load.id = key.id;
                new_load.self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + new_load.id;
                resolve(new_load)
            }, ()=>{reject(err); console.log("err:" + err)})
        }
    })
}

function get_load(load_id, req, user_id){
    return new Promise((resolve, reject)=>{
        const key = datastore.key([LOADS, parseInt(load_id, 10)]);
        datastore.get(key).then((entity)=>{
            if(entity[0] === undefined || entity[0] === null){
                reject(404);
            } else if(entity[0].owner !== user_id){
                reject(403)
            } else {
                entity.map(ds.fromDatastore)
                if(req) entity[0].self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + entity[0].id;
                resolve(entity[0]);
            }
        }, ()=>{reject()})
    })
}
/* ------------- End Loads Model Functions ------------- */
/* ------------- Begin Controller Functions ------------- */
function check_header_415(req, res, next){
    if(req.get('content-type') !== 'application/json'){
        err_message.Error = "Server only accepts application/json data.";
        res.status(415).json(err_message)
    }else{
        next()
    }
}

function check_header_406(req, res, next){
    if(!req.accepts(['application/json', '*/*'])){
        err_message.Error = "Server only sends application/json data.";
        res.status(406).json(err_message)
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
        },()=>{
            err_message.Error = "Invalid JWT.";
            res.status(401).json(err_message)
        })
    } catch {
        err_message.Error = "Invalid JWT.";
        res.status(401).json(err_message)
    }        
}
router.route("/")
    .post(check_header_415, check_header_406, check_jwt, (req, res)=>{
        post_load(req.oauth_id, req.body, req).then((new_load)=>{
            res.status(201).json(new_load)
        },()=>{
            err_message.Error = "The request object is missing at least one of the required attributes";
            res.status(400).json(err_message);
        })
    })

router.route("/:load_id")
    .get(check_header_406, check_jwt, (req, res)=>{
        get_load(req.params.load_id, req, req.oauth_id).then((load)=>{
           res.status(200).json(load); 
        },(err)=>{
            if(err===404){
                err_message.Error = "No load with this load_id exists.";
                res.status(404).json(err_message);
            } else if(err===403) {
                err_message.Error = "You don’t have permission to access this entity." ;
                res.status(403).json(err_message);
            } else{
                res.status(500).end()
            }
        })
    })
/* ------------- End Controller Functions ------------- */
exports.loads = LOADS
exports.router = router