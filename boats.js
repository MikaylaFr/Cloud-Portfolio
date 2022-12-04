const users = require('./users')
const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
router.use(bodyParser.json());
const BOATS = "Boats";

let err_message = {"Error": null};

/* ------------- Begin Boats Model Functions ------------- */
function post_boat(user_id, req_body, req){
    return new Promise((resolve, reject)=>{
        if(req_body.name === undefined || req_body.type === undefined || req_body.length === undefined){
            reject();
        } else {
            var key = datastore.key(BOATS);
            let new_boat = {
                "name": req_body.name,
                "type": req_body.type,
                "length": req_body.length,
                "owner": user_id
            }
            datastore.save({"key": key, "data": new_boat})
            .then(()=>{
                new_boat.id = key.id;
                new_boat.self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + new_boat.id;
                resolve(new_boat)
            }, ()=>{reject(err); console.log("err:" + err)})
        }
    })
}

function get_boat(boat_id, req, user_id){
    return new Promise((resolve, reject)=>{
        const key = datastore.key([BOATS, parseInt(boat_id, 10)]);
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
/* ------------- End Boats Model Functions ------------- */
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
        post_boat(req.oauth_id, req.body, req).then((new_boat)=>{
            res.status(201).json(new_boat)
        },()=>{
            err_message.Error = "The request object is missing at least one of the required attributes";
            res.status(400).json(err_message);
        })
    })

router.route("/:boat_id")
    .get(check_header_406, check_jwt, (req, res)=>{
        get_boat(req.params.boat_id, req, req.oauth_id).then((boat)=>{
           res.status(200).json(boat); 
        },(err)=>{
            if(err===404){
                err_message.Error = "No boat with this boat_id exists.";
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
exports.boats = BOATS
exports.router = router