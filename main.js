var fs = require('fs');
var HackChat = require("./hackchat.js");
var chat = new HackChat();
var channelName = "programming";
var botName = "modBot";
var channel = chat.join(channelName, botName);
var userStats = require("./userStats.json");

var users = {};

chat.on("chat", function(session, nick, text, time, isAdmin, trip) {
  if (nick != botName) {
    //nick = nick + "#" + trip;
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
    var message = "";
    for (name in userStats){
      message += name + " ~ banCount: " + userStats[name].banCount + " warningCount: " + userStats[name].warningCount + "\n";
    }
    channel.sendMessage(message);
  }
  if (text == "save") {
    console.log('saving');
    fs.writeFile("./userStats.json", JSON.stringify(userStats), function(){});
  }
});

chat.on("onlineSet", function(session, names){
  for (var i = 0; i < names.length; i++)
    createUser(names[i]);
})

chat.on("onlineAdd", function(session, nick){
  createUser(nick);
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

function createUser(nick){
  if (typeof userStats[nick] == 'undefined') //Create new object for this user in the JSON file
    userStats[nick] = {"banCount": 0, "warningCount": 0};
};

function reEvaluate(nick) {
  var maxMessages = 200; //Max amount of messages every 5 min
  var maxAvgtime = 1000; //Max difference that just baerly triggers the warning

  if (users[nick].length - 1 > maxMessages) { //Checking the count of the last messages over the last 5 min
    channel.sendMessage("@" + nick + " warning, you are typing too fast!");
    userStats[nick].warningCount ++;
    console.log('User: ' + nick + ' has been deteced for flooding the chat.');
    users[nick] = [];
  } else if (users[nick].length - 1 > 2) { //Checking the time difference between the last and third last message
    if (users[nick][users[nick].length - 1][0] - users[nick][users[nick].length - 3][0] < maxAvgtime) {
      channel.sendMessage("@" + nick + " warning, you are typing too fast!");
      userStats[nick].warningCount ++;
      console.log('User: ' + nick + ' has been deteced for fast typing in the chat.');
      users[nick] = [];
    }
  } else if (users[nick].length > 2) { //Checking the repetiviness of messages
    if (users[nick][users[nick].length - 1][1] == users[nick][users[nick].length - 3][1]) {
      channel.sendMessage("@" + nick + " warning, you are spamming!");
      userStats[nick].warningCount ++;
      console.log('User: ' + nick + ' has been deteced for spamming.');
      users[nick] = [];
    }
  }
};
