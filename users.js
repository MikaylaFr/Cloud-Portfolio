const express = require('express');
const app = express();
const axios = require('axios');
const router = express.Router();
const {Datastore} = require('@google-cloud/datastore');
const path = require('path');
const { request } = require('http');
const datastore = new Datastore();
const bodyParser = require('body-parser');
const { json } = require('express');
app.use(bodyParser.json());
const {OAuth2Client} = require('google-auth-library');
const { error } = require('console');

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
                res.set('Content-Type', 'text/html');
                let send_str = '<h2> Your JWT: ' + resp.id_token + '<h2>';
                res.send(send_str);
            },(err)=>{console.log("Something wrong")})
        }
        else{
            res.send("Something went wrong.");
            console.log(req.query)
        }
    });
/* ------------- End OAuth Controller Functions ------------- */
exports.router = router
exports.verifyJwt = verifyJwt
exports.users = USERS
