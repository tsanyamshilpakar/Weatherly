


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
const password = "admin";

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
let spotifyTrackTable = 'CREATE TABLE IF NOT EXISTS SPOTIFYTRACKS(DANCEABILITY DECIMAL, ENERGY DECIMAL, KEY DECIMAL, LOUDNESS DECIMAL, MODE INTEGER, SPEECHINESS DECIMAL, ACOUSTICNESS DECIMAL, LIVENESS DECIMAL, VALENCE DECIMAL, TEMPO DECIMAL, ID TEXT, INDEX SERIAL);';
let albumTrackTable = 'CREATE TABLE IF NOT EXISTS ALBUMNAMES(ALBUM_NAME TEXT, INDEX SERIAL);';
let artistTrackTable = 'CREATE TABLE IF NOT EXISTS ARTISTNAMES(ARTIST_NAME TEXT);';




var SpotifyWebApi = require('spotify-web-api-node');
// credentials are optional
var spotifyApi = new SpotifyWebApi({
  clientId: '45da17870f1249c0a97073f571dbdf3a',//process.env.SPOTIFY_ID,
  clientSecret: '0e8ef49e0492417ba88e3013b01fef47',//process.env.SPOTIFY_SECRECT,
  //redirectUri: 'http://www.example.com/callback'
});

//spotifyApi.setAccessToken('BQCynLuJQFgjJqfx1gD61PgXIpLooQdXKSoTEkIfqT1Dp5UgKXqwLYMtM5seVbHtREE_vz9EMBldj0YceFM');



spotifyApi.clientCredentialsGrant().then(
  function (data) {
    console.log('The access token expires in ' + data.body['expires_in']);
    console.log('The access token is ' + data.body['access_token']);

    // Save the access token so that it's used in future calls
    spotifyApi.setAccessToken(data.body['access_token']);
    clearTable();

  },
  function (err) {
    console.log(
      'Something went wrong when retrieving an access token',
      err.message
    );
  }
);


function clearTable() {
  //connectAndRun(db => db.none(clearSpotifyTable));
  //connectAndRun(db => db.none(clearArtistTable));
  //connectAndRun(db => db.none(clearAlbumTable));
  createTable();
}

function createTable() {
  connectAndRun(db => db.none(spotifyTrackTable));
  connectAndRun(db => db.none(artistTrackTable));
  connectAndRun(db => db.none(albumTrackTable));
  generatePlaylist();
  //connectAndRun(db => db.none('CREATE IF NOT EXIST TRACKID (ID TEXT, ARTIST TEXT, ALBUM TEXT);'));
};


function generatePlaylist() {
  spotifyApi.getPlaylistTracks('3WxTnGherpf7t4F0VzchD4', { offset: 0, limit: 100 })
    .then(function (data) {
      let albums = data.body.items.map(function (f) {
        return f.track.album.name;
      })
      connectAndRun(db => db.none('INSERT INTO ALBUMNAMES (ALBUM_NAME) SELECT unnest(ARRAY[$1] :: TEXT []);', [albums]));
      //console.log(albums);
      let artists = data.body.items.map(function (r) {
        return r.track.artists.map(function (j) {
          return j.name;
        });
      })
      //console.log(artists);
      //console.log(artists)
      return data.body.items.map(function (t) {
        return t.track.id;
      });
    })
    .then(function (trackIds) {
      return spotifyApi.getAudioFeaturesForTracks(trackIds);
    })
    .then(function (data) {
      let tmp = JSON.stringify(data.body.audio_features);
      connectAndRun(db => db.none('insert into SPOTIFYTRACKS(DANCEABILITY, ENERGY, KEY, LOUDNESS, MODE, SPEECHINESS, ACOUSTICNESS, LIVENESS, VALENCE, TEMPO, ID) select DANCEABILITY, ENERGY, KEY, LOUDNESS, MODE, SPEECHINESS, ACOUSTICNESS, LIVENESS, VALENCE, TEMPO, ID from json_populate_recordset(null::SPOTIFYTRACKS, $1);', [tmp]));
      //connectAndRun(db => db.none('update SPOTIFYTRACKS set ID = $1 || id;', ['spotify:track:']));
      next();
      querySongs();
    })
    .catch(function (error) {
      console.error(error);
    });


  function next() {
    spotifyApi.getPlaylistTracks('3WxTnGherpf7t4F0VzchD4', { offset: 100, limit: 100 })
      .then(function (data) {
        let albums = data.body.items.map(function (f) {
          return f.track.album.name;
        })

        connectAndRun(db => db.none('INSERT INTO ALBUMNAMES (ALBUM_NAME) SELECT unnest(ARRAY[$1] :: TEXT []);', [albums]));
        return data.body.items.map(function (t) {
          return t.track.id;
        });
      })
      .then(function (trackIds) {
        return spotifyApi.getAudioFeaturesForTracks(trackIds);
      })
      .then(function (data) {
        let tmp = JSON.stringify(data.body.audio_features);
        connectAndRun(db => db.none('insert into SPOTIFYTRACKS(DANCEABILITY, ENERGY, KEY, LOUDNESS, MODE, SPEECHINESS, ACOUSTICNESS, LIVENESS, VALENCE, TEMPO, ID) select DANCEABILITY, ENERGY, KEY, LOUDNESS, MODE, SPEECHINESS, ACOUSTICNESS, LIVENESS, VALENCE, TEMPO, ID from json_populate_recordset(null::SPOTIFYTRACKS, $1);', [tmp]));
        //connectAndRun(db => db.none('update SPOTIFYTRACKS set ID = $1 || id;', ['spotify:track:']));
      })
      .catch(function (error) {
        console.error(error);
      });
  }

  async function querySongs() {
    let clear_query = 'SELECT SPOTIFYTRACKS.INDEX, SPOTIFYTRACKS.ID, ALBUMNAMES.ALBUM_NAME, ALBUMNAMES.INDEX FROM SPOTIFYTRACKS FULL OUTER JOIN ALBUMNAMES ON SPOTIFYTRACKS.INDEX = ALBUMNAMES.INDEX where ((valence >= 0.6) AND (energy >= 0.6)) LIMIT 50;';
    let songs = await connectAndRun(db => db.any(clear_query))
    console.log(songs);
  }

}








/*Conditions
Clear: Valence >= 0.6, Mode = 1, Energy >= 0.6
Clouds: TBD
Rain:  Valence >= 0.55, Energy <= 0.55
Drizzle:  Valence <= 0.55, Mode = 1, Energy <= 0.50
Snow:  Valence >= 0.6, Mode = 1, Energy =< 0.6
Thunderstorm:  Valence <= 0.6, Energy <= 0.7
*/


//Clear
//let clear_query = 'select id from spotifytracks where ((valence >= 0.6) AND (energy >= 0.6))';
//Rain
//Drizzle
//Snow
//Thunderstorm


