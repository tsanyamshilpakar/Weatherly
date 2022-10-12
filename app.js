//import express
const express = require('express');
var path = require('path');
const app = express();


const pgp = require('pg-promise')({
  connect(client) {
    console.log('Connected to database:', client.connectionParameters.database);
  },

  disconnect(client) {
    console.log('Disconnected from database:', client.connectionParameters.database);
  }
});


// Local PostgreSQL credentials
const username = "postgres";
const password = "185465";

const url = process.env.DATABASE_URL || `postgres://${username}:${password}@localhost/`;
const db = pgp(url);


async function connectAndRun(task) {
  let connection = null;

  try {
    connection = await db.connect();
    return await task(connection);
  } catch (e) {
    throw e;
  } finally {
    try {
      connection.done();
    } catch (ignored) {

    }
  }
}


let clearSpotifyTable = 'DROP TABLE IF EXISTS SPOTIFYTRACKS;';
let clearAlbumTable = 'DROP TABLE IF EXISTS ALBUMNAMES;';
let clearArtistTable = 'DROP TABLE IF EXISTS ARTISTNAMES;';
connectAndRun(db => db.none(clearSpotifyTable));
connectAndRun(db => db.none(clearArtistTable));
connectAndRun(db => db.none(clearAlbumTable));


const spotify = require('./spotify');


let weatherTable = 'CREATE TABLE IF NOT EXISTS WEATHER(DATA TEXT);'
connectAndRun(db => db.none(weatherTable))
let userTable = 'CREATE TABLE IF NOT EXISTS USERS(USERNAME TEXT, PASSWORD TEXT);'
connectAndRun(db => db.none(userTable))
// Routes which should handle request

app.use(express.static(__dirname + '/public'))


app.get("/", function (req, res) {
  res.sendFile(__dirname + "/public/client/frontpage/index.html");
})

app.get("/signup", function (req, res) {
  res.sendFile(__dirname + "/public/client/signup/index.html");
})

app.get("/dashboard", function (req, res) {
  res.sendFile(__dirname + "/public/client/dashboard/index.html");
})

app.get("/login", function (req, res) {
  console.log('test');
  res.sendFile(__dirname + "/public/client/login/index.html");
})
app.post("/postweather", function (req, res) {

  let body = '';
  req.on('data', data => body += data);
  req.on('end', () => {
    const data = JSON.parse(body);
    connectAndRun(db => db.none(`INSERT INTO WEATHER VALUES ($1);`, [data.data]));
    res.status(201);
    res.json();
  });
})
app.post("/postspotify", function (req, res) {
  spotify;
})

app.get("/getspotify", function (req, res) {
  connectAndRun(db => db.any(`SELECT * FROM WEATHER LIMIT 1;`))
    .then(data => {
     console.log(data, 'test');
      let spotifyquery = '';
      if (data[0].data === 'Thunderstorm') {
        spotifyquery = 'SELECT SPOTIFYTRACKS.INDEX, SPOTIFYTRACKS.ID, ALBUMNAMES.ALBUM_NAME, ALBUMNAMES.INDEX FROM SPOTIFYTRACKS FULL OUTER JOIN ALBUMNAMES ON SPOTIFYTRACKS.INDEX = ALBUMNAMES.INDEX where ((valence <= 0.6) AND (energy <= 0.7)) LIMIT 50;';
      } else if (data[0].data === 'Drizzle' || data[0].data === 'Rain') {
        spotifyquery = 'SELECT SPOTIFYTRACKS.INDEX, SPOTIFYTRACKS.ID, ALBUMNAMES.ALBUM_NAME, ALBUMNAMES.INDEX FROM SPOTIFYTRACKS FULL OUTER JOIN ALBUMNAMES ON SPOTIFYTRACKS.INDEX = ALBUMNAMES.INDEX where ((valence >= 0.55) AND (energy <= 0.55)) LIMIT 50;';
      } else if (data[0].data === 'Snow') {
        spotifyquery = 'SELECT SPOTIFYTRACKS.INDEX, SPOTIFYTRACKS.ID, ALBUMNAMES.ALBUM_NAME, ALBUMNAMES.INDEX FROM SPOTIFYTRACKS FULL OUTER JOIN ALBUMNAMES ON SPOTIFYTRACKS.INDEX = ALBUMNAMES.INDEX where ((valence >= 0.6) AND (energy <= 0.6) AND (mode = 1)) LIMIT 50;';
      } else if (data[0].data === 'Clear') {
        spotifyquery = 'SELECT SPOTIFYTRACKS.INDEX, SPOTIFYTRACKS.ID, ALBUMNAMES.ALBUM_NAME, ALBUMNAMES.INDEX FROM SPOTIFYTRACKS FULL OUTER JOIN ALBUMNAMES ON SPOTIFYTRACKS.INDEX = ALBUMNAMES.INDEX where ((valence >= 0.6) AND (energy >= 0.6) AND (mode = 1)) LIMIT 50;';
      } else {
        spotifyquery = 'SELECT SPOTIFYTRACKS.INDEX, SPOTIFYTRACKS.ID, ALBUMNAMES.ALBUM_NAME, ALBUMNAMES.INDEX FROM SPOTIFYTRACKS FULL OUTER JOIN ALBUMNAMES ON SPOTIFYTRACKS.INDEX = ALBUMNAMES.INDEX where ((valence <= 0.6) AND (energy <= 0.5)) LIMIT 50;';
      }
    console.log(spotifyquery, 'test2');
      connectAndRun(db => db.any(spotifyquery))
        .then(songs => {
        console.log('test3');
          res.send(JSON.stringify(
            songs
          ));
        })
    });
})

app.get("/getusers", function (req, res) {
  let userQuery = 'SELECT USERNAME FROM USERS LIMIT 50;'
  connectAndRun(db => db.any(userQuery))
    .then(data => {
      console.log('get', data);
      res.send(JSON.stringify(
        data
      ));
    })
})

app.get("/getuser_pswd", function (req, res) {
  let userQuery = 'SELECT * FROM USERS LIMIT 50;'
  connectAndRun(db => db.any(userQuery))
    .then(data => {
      //console.log('get',data);
      res.send(JSON.stringify(
        data
      ));
    })
})

app.post("/postuser", function (req, res) {

  let body = '';
  req.on('data', data => body += data);
  req.on('end', () => {
    const data = JSON.parse(body);
    console.log('post', data);
    connectAndRun(db => db.none(`INSERT INTO USERS VALUES ($1, $2);`, [data.data[0], data.data[1]]));
    //res.redirect('/dashboard');
    res.status(201);
    res.json();
    //res.redirect('/dashboard');
  });
})



//export app
module.exports = app;

//Thunderstorm == stormy.jpg, (Drizzle || Rain) == rainy.jpg, Snow == snowy.jpg, Clear == sunny.jpg, everything else = cloudy.jpg

/*Conditions
Clear: Valence >= 0.6, Mode = 1, Energy >= 0.6
Clouds: TBD
Rain:  Valence >= 0.55, Energy <= 0.55
Drizzle:  Valence <= 0.55, Mode = 1, Energy <= 0.50
Snow:  Valence >= 0.6, Mode = 1, Energy =< 0.6
Thunderstorm:  Valence <= 0.6, Energy <= 0.7
*/
