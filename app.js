const express = require("express");
const fetch = require("node-fetch");
const querystring = require("querystring");

const app = express();

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Credentials", true);
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,content-type,application/json"
  );
  next();
});

const keys = {
  songkick: process.env.SK_KEY,
  lastfm: process.env.LF_KEY
};

const port = process.env.PORT || 5000;

// API call for location search bar
app.get("/locations/:name", (req, res) => {
  const query = req.params.name;

  if (query !== "") {
    const URL =
      "https://api.songkick.com/api/3.0/search/locations.json?query=" +
      query +
      "&apikey=" +
      keys.songkick;

    fetch(URL)
      .then(response => {
        if (response.status !== 200) {
          res.status(200);
          // console.log(
          //   "Looks like there was a problem with the SongKick location API. Status Code: " +
          //     response.status
          // );
          return;
        } else return response.json();
      })
      .then(data => {
        res.send(data);
      });
  }
});

// API call for data retrieval
app.get("/events/:locationid", (req, res) => {
  const query = req.params.locationid;

  const dataForViz = [];
  const maxPages = 10;

  fetchSongkick(query)
    .then(data => {
      // Handle multiple artist events
      data.forEach(page => {
        if (page.resultsPage) {
          if (page.resultsPage.totalEntries === 0) return;
          page.resultsPage.results.event.forEach(event => {
            // Create data structure for event information
            dataForViz.push({
              date: event.start.date,
              name: event.displayName,
              artists: event.performance,
              link: event.uri
            });
          });
        }
      });
      const fetches = [];
      dataForViz.forEach(event => {
        event.artists.forEach(artist => {
          fetches.push(fetchLastFm(artist));
        });
      });
      return Promise.all(fetches);
    })
    .then(() => {
      res.send(dataPrep(dataForViz));
    });

  function fetchSongkick(location) {
    const songkickURL =
      "https://api.songkick.com/api/3.0/metro_areas/" +
      location +
      "/calendar.json?apikey=" +
      keys.songkick;

    return baseFetch(1).then(data => {
      const songkickReqs = [];
      const totalEntries = data.resultsPage.totalEntries;
      const reqPages =
        totalEntries < maxPages * 50 ? Math.ceil(totalEntries / 50) : maxPages;

      songkickReqs.push(data);
      for (let i = 2; i <= reqPages; i++) {
        songkickReqs.push(baseFetch(i));
      }
      return Promise.all(songkickReqs);
    });

    function baseFetch(page) {
      const pageParam = "&page=" + page;
      return fetch(songkickURL + pageParam).then(response => {
        if (response.status !== 200) {
          res.status(200);
          return;
        } else return response.json();
      });
    }

    function dataPrep(dataset) {
      const genreList = {};
      const filterItems = ["seen live", "All", "under 2000 listeners"];

      dataset.forEach(event => {
        event.artists.forEach(artist => {
          if (artist.topGenres) {
            artist.topGenres.forEach(genre => {
              if (!genreList[genre.name]) {
                genreList[genre.name] = genre.count;
              } else {
                genreList[genre.name] += genre.count;
              }
            });
          }
        });
      });

      const toptags = Object.keys(genreList)
        .sort((a, b) => {
          return genreList[b] - genreList[a];
        })
        .slice(0, 30)
        .filter(genre => {
          let present = true;
          filterItems.forEach(fakeGenre => {
            if (genre === fakeGenre) present = false;
          });
          return present;
        })
        .slice(0, 20);

      return reOrganise(dataset, toptags);

      function reOrganise(data, top20) {
        const output = [];
        data.forEach(event => {
          event.artists.forEach(artist => {
            if (artist.topGenres) {
              artist.topGenres.forEach(genre => {
                top20.forEach(hotGenre => {
                  if (genre.name === hotGenre) {
                    output.push({
                      genre: genre.name,
                      weight: genre.count,
                      date: event.date,
                      details: event
                    });
                  }
                });
              });
            }
          });
        });
        return output;
      }
    }
  }

  function fetchLastFm(artist) {
    const lastfmURL =
      "http://ws.audioscrobbler.com/2.0/?method=artist.gettoptags&artist=" +
      querystring.escape(artist.displayName) +
      "&api_key=" +
      keys.lastfm +
      "&format=json";

    return fetch(lastfmURL).then(response => {
      if (response.status !== 200) {
        res.status(200);
        return;
      } else
        return response.json().then(data => {
          if (data.toptags) {
            artist.topGenres = data.toptags.tag;
          }
        });
    });
  }
});

app.listen(port, () => {
  console.log("listening on port " + port);
});
