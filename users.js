const express = require('express');
const app = express();
const axios = require('axios');
const router = express.Router();
const path = require('path');
const { request } = require('http');
const ds = require('./datastore');
const datastore = ds.datastore;
const bodyParser = require('body-parser');
const { json } = require('express');
app.use(bodyParser.json());
const {OAuth2Client} = require('google-auth-library');
const { error } = require('console');
const { resolve } = require('path');

const client_id = "x";
const client_secret = "x";
const get_oauth_url = "x";
const gredirect = "x";
const USERS = "Users";
const STATES = "States"
const client = new OAuth2Client(client_id);

async function verifyJwt(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: client_id
    })
    let payload = ticket.getPayload();
    let return_payload = [payload['sub'], payload['name']]
    return return_payload;
}

/* ------------- Begin OAuth Functions ------------- */
function generate_state(){
    return new Promise((resolve, reject)=>{
        // Generate random num
        //https://attacomsian.com/blog/javascript-generate-random-string
        const rand_num = Math.random().toString(16).substr(2,16)
        let key = datastore.key(STATES);
        let new_user = {
            "state": rand_num
        }
        datastore.save({"key": key, "data": new_user})
        .then(()=>{
            let response_type = "code";
            let scope = "profile";
            let redirect_uri = gredirect+"&scope="+scope+"&state="+new_user.state  
            let user_redirect = get_oauth_url+"?response_type="+response_type
            +"&client_id="+client_id+"&redirect_uri="+redirect_uri;
            resolve(user_redirect);    
        },(err)=>{console.log("Couldnt save state " + err)})
    })
}

function confirm_state(state){
    return new Promise((resolve, reject)=>{
        const query = datastore.createQuery(STATES)
        .filter('state','=',state);
        datastore.runQuery(query).then((results)=>{
            if(results[0][0] !== undefined && results[0][0] !== null){
                resolve()
            }
            else{
                reject()
            }
        },(err)=>{console.log("Couldnt run query for state");reject(err)})
    })
}

function get_token(params){
    return new Promise((resolve, reject)=>{
        confirm_state(params.state).then(()=>{
            axios.post('https://oauth2.googleapis.com/token', 
            {
                "code": params.code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": gredirect,
                "grant_type": "authorization_code"
            },{
                headers: {
                    'Accept-Encoding': 'application/json'
                }
            }
            ).then((results)=>{resolve(results.data)},
        (err)=>{console.log("Error getting token");reject(err)})
        })
    })
}

function registration(token){
    let add_user = (sub, name) =>{
        return new Promise((resolve, reject)=>{
            var key = datastore.key(USERS);
            var new_user = {"oauth_id": sub, "name": name};
            datastore.save({"key": key, "data": new_user}).then(()=>{
                resolve(key.id)
            }, ()=>{console.log("Couldnt save new user"); reject()})
        })
    } 

    return new Promise((resolve, reject)=>{
        verifyJwt(token).then((curr_user)=>{
            let sub = curr_user[0];
            let name = curr_user[1];
            const query = datastore.createQuery(USERS)
            .filter('oauth_id', '=', sub)
            datastore.runQuery(query).then((results)=>{
                if(results[0] === undefined || results[0] === null || results[0].length === 0){
                    add_user(sub, name).then((id)=>{resolve(id)})
                }
                else{
                    results[0].map(ds.fromDatastore)
                    resolve(results[0][0].id)
                }
            },()=>{console.log("Couldnt search datastore");reject()})
        })
    })
    
}

function get_users(){
    const query = datastore.createQuery(USERS);
    return datastore.runQuery(query).then((entities) => {
        return entities[0].map(ds.fromDatastore);
    })
}

/* ------------- End OAuth Functions ------------- */
/* ------------- Begin OAuth Controller Functions ------------- */

router.route('/').get((req, res)=>{
    res.sendFile(path.join(__dirname+'/index.html'));
});

router.route('/oauth')
    .get((req, res)=>{
        if(Object.keys(req.query).length==0){
            generate_state().then((user_redirect)=>{
                res.status(307).redirect(user_redirect);
            })
        }
        else if(req.query.state!==undefined){
            get_token(req.query).then((resp)=>{
                registration(resp.id_token).then((user_id)=>{
                    res.set('Content-Type', 'text/html');
                let send_str = '<h2> Your JWT: ' + resp.id_token + '</h2>'
                + '<h2> Your User_Id: ' + user_id + '</h2>';
                res.send(send_str);
                })
            },(err)=>{console.log("Something wrong")})
        }
        else{
            res.send("Something went wrong.");
            console.log(req.query)
        }
    });

router.route('/users')
    .get((req, res)=>{
        get_users().then((list)=>{
            res.status(200).send(list)
        })
    })
    .all((req, res)=>{
        res.status(405).end()
    })
/* ------------- End OAuth Controller Functions ------------- */
exports.router = router
exports.verifyJwt = verifyJwt
