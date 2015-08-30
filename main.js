var fs = require('fs');
var HackChat = require("./hackchat.js");
var chat = new HackChat();
var channelName = "programming";
var botName = "modBot";
var channel = chat.join(channelName, botName);
var userStats = require("./userStats.json");

var users = {};
var updated = {};

chat.on("chat", function(session, nick, text, time, isAdmin, trip) {
  if (nick != botName) {
    if (typeof trip != 'undefined')
      nick = nick + "." + trip;
    if (typeof userStats[nick] == 'undefined')
      userStats[nick] = {"banCount": 0, "warningCount": 0};
    if (typeof users[nick] != 'undefined')
      users[nick].push([time, text]);
    else {
      users[nick] = [];
      users[nick].push([time, text]);
    }

    reEvaluate(nick);
    setTimeout(function() {
      users[nick].shift();
    }, 5 * 60 * 1000); //Substract a message counter after 5 minutes
  }
  if (text == "stats") {
    if (updated.length != 0) {
    var message = "Updated users over the last 5 hours\n";
    for (name in updated){
      message += name + " ~ banCount: " + userStats[name].banCount + " warningCount: " + userStats[name].warningCount + "\n";
    }
    channel.sendMessage(message);
    }
    else {
      channel.sendMessage("No recent changes.");
    }
  }
  else if (text == "allStats") {
    var message = "";
    for (name in userStats){
      message += name + " ~ banCount: " + userStats[name].banCount + " warningCount: " + userStats[name].warningCount + "\n";
    }
    channel.sendMessage(message);
  }
  else if (text == "save") {
    console.log('saving');
    fs.writeFile("./userStats.json", JSON.stringify(userStats), function(){});
  }
  if (nick == "*") {
    if (text.indexOf("Banned") != -1) {
      var bannedUser = text.split(" ")[1];
      userStats[bannedUser].banCount++;
    }
  }
});

chat.on("joining", function(){
  console.log('All systems online');
  setInterval(function(){fs.writeFile("./userStats.json", JSON.stringify(userStats), function(){});}, 30 * 60 * 1000);
  setInterval(function(){channel.ping();}, 3 * 60 * 1000);
});

chat.on("nicknameTaken", function(){
  console.log('nicknameTaken');
});

chat.on("ratelimit", function() {
  console.log("Rate limit");
});

// chat.on("left", function(){
//   console.log('quit');
//   fs.writeFile("./userStats.json", JSON.stringify(userStats), function(){});
// });

function reEvaluate(nick) {
  var maxMessages = 200; //Max amount of messages every 5 min
  var maxAvgtime = 1000; //Max difference that just baerly triggers the warning

  if (users[nick].length - 1 > maxMessages) { //Checking the count of the last messages over the last 5 min
    channel.sendMessage("@" + nick + " warning, you are typing too fast!");
    userStats[nick].warningCount ++;
    console.log('User: ' + nick + ' has been deteced for flooding the chat.');
    users[nick] = [];
    updatedUsers(nick);
  } else if (users[nick].length - 1 > 2) { //Checking the time difference between the last and third last message
    if (users[nick][users[nick].length - 1][0] - users[nick][users[nick].length - 3][0] < maxAvgtime) {
      channel.sendMessage("@" + nick + " warning, you are typing too fast!");
      userStats[nick].warningCount ++;
      console.log('User: ' + nick + ' has been deteced for fast typing in the chat.');
      users[nick] = [];
      updatedUsers(nick);
    }
  } else if (users[nick].length > 2) { //Checking the repetiviness of messages
    if (users[nick][users[nick].length - 1][1] == users[nick][users[nick].length - 3][1]) {
      channel.sendMessage("@" + nick + " warning, you are spamming!");
      userStats[nick].warningCount ++;
      console.log('User: ' + nick + ' has been deteced for spamming.');
      users[nick] = [];
      updatedUsers(nick);
    }
  }
};
