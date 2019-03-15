const express = require("express");
const fetch = require('node-fetch');

const app = express();

const keys = {
  songkick: process.env.SK_KEY,
  lastfm: process.env.LF_KEY
}

const port = process.env.PORT || 5000;

/*
/locations/
/events/
*/

app.get("/location/:name", (req, res) => {
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
        } else res.send(response);
      })
  }
});

app.listen(port, () => {
  console.log("listening on port " + port);
});
