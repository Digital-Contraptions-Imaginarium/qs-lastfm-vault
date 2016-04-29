/* *************************************************************************
   This script was written to create an songs I scrobbled in Last.FM, mostly
   by playing them in Spotify. The Last.FM APIs are described at 
   http://www.last.fm/api . Every execution fetches the maximum possible 
   number of tracks (200), in order to minimise call frequency (once every 4
   hours).
   ************************************************************************* */

// Note: a Google spreadsheet can contain max 2m cells according to
// https://support.google.com/drive/answer/37603?hl=en .

var SPREADSHEET_URL = "https://docs.google.com/spreadsheets/d/1guUdLTpXSMxvEwhrfZQP72Myoqj3P0Nsc8MzhU8wu8s/edit",
    UTILISATION_SOFT_LIMIT = .95,
    LASTFM_USERNAME = "giacecco",
    LASTFM_API_KEY = PropertiesService.getScriptProperties().getProperty("LASTFM_API_KEY");

var dateToCSVDate = function (d) {
    // Note how I force the date to be stored as a string, to avoid Google
    // spreadsheet interpreting it and perhaps change its format when it is
    // exported.
    return "'" + d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2) + " " + 
        ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) + ":" + ("0" + d.getSeconds()).slice(-2); 

}

var garbageCollect = function (callback) {
    var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL),
        sheetToClean = spreadsheet.getSheetByName("played"),
        availableCells = Math.floor(2000000.0 * UTILISATION_SOFT_LIMIT);
    spreadsheet.getSheets().forEach (function (sheet) {
        availableCells -= sheet.getLastColumn() * sheet.getLastRow();
    });
    if (availableCells < 0) {
        var minRowNoToClean = Math.ceil(-availableCells / sheetToClean.getLastColumn());
        sheetToClean.deleteRows(2, 1 + minRowNoToClean);
    }
    if (callback) callback(null);
}

var fetch = function () {
    // TODO: check the return code and manage errors
    var tracks = JSON.parse(UrlFetchApp.fetch("https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=" + LASTFM_USERNAME + "&api_key=" + LASTFM_API_KEY + "&format=json&limit=200").getContentText()).recenttracks.track;
    // drop tracks that are still playing
    tracks = _.filter(tracks, function (track) { return track.date; });
    // drop the fields I don't plan to use and transform the ones that need to
    tracks = tracks.map(function (track) {
        delete track.streamable;
        delete track.url;
        track.date = new Date(parseInt(track.date.uts + "000")); // Note this appears to be UK time adapted for DST 
        // TODO: if MusicBrainz keeps the covers I don't need to keep a reference to Last.FM's
        track.image = _.find(track.image, function (image) { return image.size === "extralarge"; })["#text"];
        return track;        
    });
    // sort by date
    return tracks.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

var fetchAndStoreActual = function (callback) {
    var spreadsheet = SpreadsheetApp.openByUrl(SPREADSHEET_URL),
        sheet = spreadsheet.getSheetByName("played"),
        data = fetch(),
        datesToWrite = data.map(function (track) { return dateToCSVDate(track.date); }),
        previousDates = _.flatten(sheet.getRange("R2C1:R" + Math.max(2, sheet.getLastRow()) + "C1").getValues()),
        firstDateToReplace = _.find(previousDates, function (previousDate) { return _.contains(datesToWrite, previousDate); }), 
        firstRowToReplace = 3 + previousDates.indexOf(firstDateToReplace);
    sheet.getRange(firstRowToReplace + ":" + (firstRowToReplace + datesToWrite.length - 1)).setValues(data.map(function (track) {
        return [ dateToCSVDate(track.date), JSON.stringify(track) ];
    })); 
    callback(null);
}

function run () {
  garbageCollect(function (err) {
      fetchAndStoreActual(function (err) { });
  });
}
