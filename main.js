var fs = require('fs');
var HackChat = require("./hackchat.js");
var chat = new HackChat();
var channelName = "botDev";
var botName = "modBot";
var channel = chat.join(channelName, botName);
var userStats = require("./userStats.json");
var mods = ["BD74uK"];

var users = {};

chat.on("chat", function(session, nick, text, time, isAdmin, trip) {
  var oldnick = nick;
  if (nick != botName) {
    if (trip != null)
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
  }
  if (text == ".stats") {
      channel.sendMessage("@" + nick + " ~ banCount: " + userStats[nick].banCount + " warningCount: " + userStats[nick].warningCount + "\n");
  } else if (text == ".allStats" && mods.indexOf(trip) != -1) {
    var message = "";
    for (name in userStats) {
      message += name + " ~ banCount: " + userStats[name].banCount + " warningCount: " + userStats[name].warningCount + "\n";
    }
    channel.sendMessage(message);
  } else if (text == ".save" && mods.indexOf(trip) != -1) {
    console.log('saving');
    fs.writeFile("./userStats.json", JSON.stringify(userStats), function() {});
  } else if (text.split(" ")[0] == ".ban" && mods.indexOf(trip) != -1) {
    console.log(channel.sendRaw({cmd:"ban", nick:text.split(" ")[1]}));
  }

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
  var maxSimilarity = 0.7; //Max similarity between the first and third message
console.log(users[nick].length);

if (users[nick].length > 2) { //Checking the repetiviness of messages
  var firstMessage = users[nick][users[nick].length - 1][1];
  var thirdMessage = users[nick][users[nick].length - 3][1];
  //console.log(similar_text(firstMessage, thirdMessage)/(String(firstMessage + thirdMessage).length/2));
  if ((similar_text(firstMessage, thirdMessage)/(String(firstMessage + thirdMessage).length/2)) >= maxSimilarity) {
    channel.sendMessage("@" + nick + " warning: " + userStats[nick].warningCount + ", you are spamming!");
    userStats[nick].warningCount++;
    console.log('User: ' + nick + ' has been deteced for spamming.');
    users[nick] = [];
  }
} else if (users[nick].length - 1 > maxMessages) { //Checking the count of the last messages over the last 5 min
    channel.sendMessage("@" + nick + " warning: " + userStats[nick].warningCount + ", you are typing too much ~ possible spam!");
    userStats[nick].warningCount++;
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


function similar_text(first, second, percent) {
  //  discuss at: http://phpjs.org/functions/similar_text/
  // original by: Rafał Kukawski (http://blog.kukawski.pl)
  // bugfixed by: Chris McMacken
  // bugfixed by: Jarkko Rantavuori original by findings in stackoverflow (http://stackoverflow.com/questions/14136349/how-does-similar-text-work)
  // improved by: Markus Padourek (taken from http://www.kevinhq.com/2012/06/php-similartext-function-in-javascript_16.html)
  if (first === null || second === null || typeof first === 'undefined' || typeof second === 'undefined')
    return 0;

  first += '';
  second += '';

  var pos1 = 0,
    pos2 = 0,
    max = 0,
    firstLength = first.length,
    secondLength = second.length,
    p, q, l, sum;

  max = 0;

  for (p = 0; p < firstLength; p++) {
    for (q = 0; q < secondLength; q++) {
      for (l = 0;
        (p + l < firstLength) && (q + l < secondLength) && (first.charAt(p + l) === second.charAt(q + l)); l++)
      ;
      if (l > max) {
        max = l;
        pos1 = p;
        pos2 = q;
      }
    }
  }

  sum = max;

  if (sum) {
    if (pos1 && pos2) {
      sum += similar_text(first.substr(0, pos1), second.substr(0, pos2));
    }

    if ((pos1 + max < firstLength) && (pos2 + max < secondLength)) {
      sum += similar_text(first.substr(pos1 + max, firstLength - pos1 - max), second.substr(pos2 + max, secondLength - pos2 - max));
    }
  }

  if (!percent) {
    return sum;
  } else {
    return (sum * 200) / (firstLength + secondLength);
  }
}
