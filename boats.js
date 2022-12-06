const errors = require('./errors');
const loads = require('./loads');
const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');
const datastore = ds.datastore;
router.use(bodyParser.json());
const BOATS = "Boats";
var util = require('util');

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

function get_boat(boat_id, req, user_id, internal){
    let get_loads = new Promise((resolve, reject)=>{
        let query = datastore.createQuery(loads.loads)
        .filter('carrier','=',boat_id)
        datastore.runQuery(query).then((results)=>{
            if(results[0][0] !== undefined && results[0][0] !== null){
                results[0].map(ds.fromDatastore)
                for(var i=0;i<results[0].length;i++){
                    results[0][i].self = req.protocol + "://" + req.get("host") + "/loads/" + results[0][i].id;
                }
            }
            resolve(results[0]);
        },(err)=>{console.log("Couldnt run query for loads");reject(err)})
    })
    return new Promise((resolve, reject)=>{
        const key = datastore.key([BOATS, parseInt(boat_id, 10)]);
        datastore.get(key).then((entity)=>{
            if(entity[0] === undefined || entity[0] === null){
                reject(404);
            } else if(!internal && entity[0].owner !== user_id){
                reject(403)
            } else {
                entity.map(ds.fromDatastore)
                entity[0].loads = [];
                entity[0].self = req.protocol + "://" + req.get("host") + req.baseUrl + "/" + entity[0].id;
                if(!internal){
                    get_loads.then((curr_loads)=>{
                        if(curr_loads !== null){
                            entity[0].loads = curr_loads;
                        }
                        resolve(entity[0]);
                    })
                }else{
                    resolve(entity[0]);
                }
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
    let update_val = (passed_val, saved_val)=>{
        if(passed_val === undefined) return saved_val;
        return passed_val
    }
    return new Promise((resolve, reject)=>{
        get_boat(boat_id, req, user_id, false).then((boat)=>{
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

function put_boat(boat_id, user_id, req_body, req){
    return new Promise((resolve, reject)=>{
        if(req_body.name === undefined || req_body.type === undefined || req_body.length === undefined){
            reject(400);
        } else {
            patch_boat(boat_id, user_id, req_body, req).then((boat)=>{
                resolve(boat)
            },(err)=>{reject(err)})
        }
    })
}

function get_all_boats(user_id, req){
    results = {};
    
    let get_users_boats_count = new Promise((resolve, reject)=>{
        const query = datastore.createQuery(BOATS)
            .filter('owner', '=', user_id)
            .select('__key__');
        datastore.runQuery(query).then((keys)=>{
            results.total_items = keys[0].length;
            resolve();
        },()=>{console.log("Couldnt get boats");reject(500)})
    })

    let get_users_boats_pagination = new Promise((resolve, reject)=>{
        get_users_boats_count.then(()=>{
            var query = datastore.createQuery(BOATS)
            .filter('owner', '=', user_id)
            .select('__key__')
            .limit(5);
            if(Object.keys(req.query).includes("cursor")){
                cursor = decodeURIComponent(req.query.cursor);
                query = query.start(cursor);   
            }
            datastore.runQuery(query).then((entities) => {
                if(entities[0].length > 0){
                    entities[0].map(ds.fromDatastore);
                }
                if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS){
                    results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + encodeURIComponent(entities[1].endCursor);
                }
                resolve(entities[0]);
            }, (err) => {console.log("Something went wrong getting keys\n" + err); reject(500)});
        },(err)=>{reject(err)})
    })

    return new Promise((resolve, reject)=>{
        get_users_boats_pagination.then((keys)=>{
            let all_boats = [];
            keys.forEach((curr_key) => {
                all_boats.push(get_boat(curr_key.id, req, user_id, false))
            });
            Promise.all(all_boats).then((boats_info) => {
                results.boats = boats_info;
                resolve(results)})
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
    .get(errors.check_406, errors.check_jwt, (req, res)=>{
        get_all_boats(req.oauth_id, req).then((boat)=>{
           res.status(200).json(boat); 
        },(err)=>{
            res.status(err).json(errors.err_message[err]);
        })
    })
    .all((req, res)=>{
        res.status(405).end()
    })

router.route("/:boat_id")
    .get(errors.check_406, errors.check_jwt, (req, res)=>{
        get_boat(req.params.boat_id, req, req.oauth_id, false).then((boat)=>{
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
    .put(errors.check_406, errors.check_415, errors.check_jwt, (req, res)=>{
        put_boat(req.params.boat_id, req.oauth_id, req.body, req).then((boat)=>{
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
exports.get_boat = get_boat