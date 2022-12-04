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

// TODO: Delete from loads
function delete_boat(boat_id, user_id){
    const key = datastore.key([BOATS, parseInt(boat_id, 10)]);
    var check_boat_exists = new Promise((resolve, reject)=>{
        datastore.get(key).then((entity)=>{
            if(entity[0] === undefined || entity[0] === null){
                reject(404);
            } else if(entity[0].owner !== user_id){
                reject(403)
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

function patch_boat(boat_id, user_id, body, req){
    //Get boat - Will check user id and if boat exists
    let update_val = (passed_val, saved_val)=>{
        if(passed_val === undefined) return saved_val;
        return passed_val
    }
    return new Promise((resolve, reject)=>{
        get_boat(boat_id, req, user_id).then((boat)=>{
            let updated_boat = {
                "length":update_val(body.length,boat.length),
                "name":update_val(body.name,boat.name),
                "owner":boat.owner,
                "type":update_val(body.type,boat.type),
            }
            var key = datastore.key([BOATS, parseInt(boat_id, 10)]);
            datastore.update({"key": key, "data": updated_boat}).then(()=>{
                boat.length = updated_boat.length;
                boat.name = updated_boat.name;
                boat.type = updated_boat.type;
                resolve(boat);
            },()=>{reject(500)})
        },(err)=>{reject(err)})
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
    .all((req, res)=>{
        res.status(405).end()
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
        delete_boat(req.params.boat_id, req.oauth_id).then(() => {
            res.status(204).end();
        }, (err) => {
            res.status(err).json(errors.err_message[err]);
        })
    })
    .patch(errors.check_406, errors.check_415, errors.check_jwt, (req, res)=>{
        patch_boat(req.params.boat_id, req.oauth_id, req.body, req).then((boat)=>{
            res.status(200).json(boat); 
        },(err)=>{
            res.status(err).json(errors.err_message[err]);
        })
    })
    .all((req, res)=>{
        res.status(405).end()
    })
/* ------------- End Controller Functions ------------- */
exports.boats = BOATS
exports.router = router