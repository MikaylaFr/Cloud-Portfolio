const users = require('./users');
const errors = require('./errors');
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
            reject(400);
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
            }, ()=>{reject(500); console.log("Couldnt save load")})
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
        }, ()=>{reject(500); console.log("Couldnt get from datastore")})
    })
}
/* ------------- End Loads Model Functions ------------- */
/* ------------- Begin Controller Functions ------------- */
router.route("/")
    .post(errors.check_415, errors.check_406, errors.check_jwt, (req, res)=>{
        post_load(req.oauth_id, req.body, req).then((new_load)=>{
            res.status(201).json(new_load)
        },(err)=>{
            res.status(err).json(errors.err_message[err]);
        })
    })

router.route("/:load_id")
    .get(errors.check_406, errors.check_jwt, (req, res)=>{
        get_load(req.params.load_id, req, req.oauth_id).then((load)=>{
           res.status(200).json(load); 
        },(err)=>{
            res.status(err).json(errors.err_message[err]);
        })
    })
/* ------------- End Controller Functions ------------- */
exports.loads = LOADS
exports.router = router