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

const client_id = "1085852629063-4dae7p2vqovotaigtmijp79efgc5nton.apps.googleusercontent.com";
const client_secret = "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";
const get_oauth_url = "https://accounts.google.com/o/oauth2/v2/auth";
const gredirect = "http://localhost:8080/oauth";
const USERS = "Users";
const STATES = "States"
const client = new OAuth2Client(client_id);

async function verifyJwt(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: client_id
    })
    let payload = ticket.getPayload();
    return payload['sub'];
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
    let add_user = (sub) =>{
        return new Promise((resolve, reject)=>{
            var key = datastore.key(USERS);
            var new_user = {"oauth_id": sub};
            datastore.save({"key": key, "data": new_user}).then(()=>{
                console.log("Key" + key.id)
                resolve(key.id)
            }, ()=>{console.log("Couldnt save new user"); reject()})
        })
    } 

    return new Promise((resolve, reject)=>{
        verifyJwt(token).then((sub)=>{
            const query = datastore.createQuery(USERS)
            .filter('oauth_id', '=', sub)
            datastore.runQuery(query).then((results)=>{
                if(results[0] === undefined || results[0] === null || results[0].length === 0){
                    add_user(sub).then((id)=>{resolve(id)})
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
