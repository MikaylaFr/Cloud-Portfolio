const users = require('./users');
const errors = require('./errors');
const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
router.use(bodyParser.json());
const BOATS = "Boats";

/* ------------- Begin Boats Model Functions ------------- */
function post_boat(user_id, req_body, req){
    return new Promise((resolve, reject)=>{
        if(req_body.name === undefined || req_body.type === undefined || req_body.length === undefined){
            reject(400);
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
            }, ()=>{reject(500); console.log("Couldnt save boat")})
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
        }, ()=>{reject(500); console.log("Couldnt get from datastore")})
    })
}

function delete_boat(boat_id, user_id){
    const key = datastore.key([BOATS, parseInt(boat_id, 10)]);
    var check_boat_exists = new Promise((resolve, reject)=>{
        datastore.get(key).then((entity)=>{
            if(entity[0] === undefined || entity[0] === null){
                reject(404);
            } else {
                resolve();
            }
        }, ()=>{
            reject(500); console.log("Couldnt get from datastore");
        })
    })

    return new Promise((resolve, reject)=>{
        check_boat_exists.then(()=>{
            datastore.delete(key);
            resolve();
        }, (err)=>{reject(err)})
    })
}
/* ------------- End Boats Model Functions ------------- */
/* ------------- Begin Controller Functions ------------- */
router.route("/")
    .post(errors.check_415, errors.check_406, errors.check_jwt, (req, res)=>{
        post_boat(req.oauth_id, req.body, req).then((new_boat)=>{
            res.status(201).json(new_boat)
        },(err)=>{
            res.status(err).json(errors.err_message[err]);
        })
    })

router.route("/:boat_id")
    .get(errors.check_406, errors.check_jwt, (req, res)=>{
        get_boat(req.params.boat_id, req, req.oauth_id).then((boat)=>{
           res.status(200).json(boat); 
        },(err)=>{
            res.status(err).json(errors.err_message[err]);
        })
    })
    .delete(errors.check_jwt, (req, res)=>{
        delete_boat(req.params.boat_id).then(() => {
            res.status(204).end();
        }, (err) => {
            res.status(err).json(errors.err_message[err]);
        })
    })
/* ------------- End Controller Functions ------------- */
exports.boats = BOATS
exports.router = router