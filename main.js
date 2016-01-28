var fs = require('fs');
var HackChat = require("./hackchat.js");
var chat = new HackChat();
var config = require("./config.json");
var channel = chat.join(config.botChannel, config.botName, config.botPass);
var userStats = require("./userStats.json");

var users = {};

chat.on("chat", function(session, nick, text, time, isAdmin, trip) {
  var oldnick = nick;
  if (nick != config.botName) {
    if (trip !== 'undefined')
      nick = nick + "#" + trip;
    if (typeof userStats[nick] == 'undefined')
      userStats[nick] = {
        "banCount": 0,
        "warningCount": 0
      };
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
    setTimeout(function() {
      console.log('saving', Date.now());
      fs.writeFile("./userStats.json", JSON.stringify(userStats), function() {});
    }, 5 * 60 * 1000);
  }
  if (text.split(" ")[0] == ".stats") {
      if (config.mods.indexOf(trip) != -1) {
        var matches = getName(nick)
        var message = "";
        for (var user in matches)
          message += "@" + nick + " ~ banCount: " + userStats[user].banCount + " warningCount: " + userStats[user].warningCount + "\n"
          channel.sendMessage(message);
      } else
        channel.sendMessage("@" + nick + " ~ banCount: " + userStats[nick].banCount + " warningCount: " + userStats[nick].warningCount + "\n");
  } else if (text == ".allStats" && config.mods.indexOf(trip) != -1) {
    var message = "";
    for (name in userStats)
      if (!(userStats[name].banCount == 0 || userStats[name].warningCount == 0))
        message += name + " ~ banCount: " + userStats[name].banCount + " warningCount: " + userStats[name].warningCount + "\n";
    channel.sendMessage(message);
  } else if (text == ".save" && config.mods.indexOf(trip) != -1) {
      fs.writeFile("./userStats.json", JSON.stringify(userStats), function() {});
  } else if (text.split(" ")[0] == ".ban" && config.mods.indexOf(trip) != -1) {
      channel.sendRaw({cmd:"ban", nick:text.split(" ")[1]});
  } else if (text == ".source")
      channel.sendMessage(config.botName + " is written by ToastyStoemp, the source code  can be found here: https://github.com/ToastyStoemp/modBot ");

  if (nick == "*") {
    if (text.indexOf("Banned") != -1) {
      var bannedUser = text.split(" ")[1];
      userStats[bannedUser].banCount++;
    }
  }
});

chat.on("joining", function() {
  console.log('All systems online');
  setInterval(function() {
    fs.writeFile("./userStats.json", JSON.stringify(userStats), function() {});
  }, 30 * 60 * 1000);
  setInterval(function() {
    channel.ping();
  }, 3 * 60 * 1000);
});

chat.on("nicknameTaken", function() {
  console.log('nicknameTaken');
});

chat.on("ratelimit", function() {
  console.log("Rate limit");
});

function reEvaluate(nick) {
  var maxMessages = 200; //Max amount of messages every 5 min
  var maxAvgtime = 1000; //Max difference that just baerly triggers the warning
  var maxSimilarityMultiLine = 0.75; //Max similarity between the first and third message
  var maxSimilaritySingleLine = 0.70; //Max similarity between the words in the text

if (users[nick].length > 2) { //Checking the repetiviness of messages
  var firstMessage = users[nick][users[nick].length - 1][1];
  var thirdMessage = users[nick][users[nick].length - 3][1];
  if (similar_text(firstMessage, thirdMessage) >= maxSimilarityMultiLine) {
    userStats[nick].warningCount++;
    channel.sendMessage("@" + nick + " warning: " + userStats[nick].warningCount + ", you are spamming!");
    console.log('User: ' + nick + ' has been deteced for spamming.');
    users[nick] = [];
  }
} else if (similar_inlineText(users[nick][users[nick].length - 1][1], maxSimilaritySingleLine)) {
    userStats[nick].warningCount++;
    channel.sendMessage("@" + nick + " warning: " + userStats[nick].warningCount + ", you are spamming!");
    console.log('User: ' + nick + ' has been deteced for spamming');
    users[nick] = [];
} else if (users[nick].length - 1 > maxMessages) { //Checking the count of the last messages over the last 5 min
    userStats[nick].warningCount++;
    channel.sendMessage("@" + nick + " warning: " + userStats[nick].warningCount + ", you are typing too much ~ possible spam!");
    console.log('User: ' + nick + ' has been deteced for flooding the chat.');
    users[nick] = [];
} else if (users[nick].length - 1 > 2) { //Checking the time difference between the last and third last message
    if (users[nick][users[nick].length - 1][0] - users[nick][users[nick].length - 3][0] < maxAvgtime) {
      userStats[nick].warningCount++;
      channel.sendMessage("@" + nick + " warning: " + userStats[nick].warningCount + ", you are typing too fast!");
      console.log('User: ' + nick + ' has been deteced for fast typing in the chat.');
      users[nick] = [];
    }
  }
};

function getName(nick) {
   var matches = [];
   for(var user in userStats){
      matches.push(user);
   }
   return matches;
}

function similar_text(first, second) {
  if (first == second)
    return 1;

  firstArr = first.split(' ');
  for (word in firstArr){
    if (firstArr[word].indexOf('@') != -1)
      firstArr.splice(firstArr[word], 1);
    else
      firstArr[word] = firstArr[word].split('').sort().join('');
  }
  firstArr = firstArr.sort();

  secondArr = second.split(' ');
  for (word in secondArr){
    if (secondArr[word].indexOf('@') != -1)
      secondArr.splice(secondArr[word], 1);
    else
      secondArr[word] = secondArr[word].split('').sort().join('');
  }
  secondArr = secondArr.sort()

  var similarityCounter = 0;
  for (word in first)
    if (first[word] == second[word])
      similarityCounter++;

  return similarityCounter/((first.length + second.length)/2.0);
}

function similar_inlineText(text, maxSimilarity) {
  var checkedWords = [];
  var textArr = text.split(' ');
  if (textArr.length < 7)
    return false;
  for (var i = 0; i < textArr.length - 1; i++) {
    var wordCount = 1;
    if (checkedWords.indexOf(textArr[i]) == -1) {
      for (var k = i + 1; k < textArr.length; k++)
        if (textArr[i] == textArr[k])
          wordCount++;
      if (wordCount / textArr.length >= maxSimilarity )
        return true;
    }
    checkedWords.push(textArr[i]);
  }
  return false;
}
